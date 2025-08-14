/**
 * Marketing Machine - Smart Scheduling System
 * Phase 7: Smart Publishing System
 */

const { query } = require('../../config/database');
const logger = require('../../utils/logger');
const { ValidationError } = require('../../utils/errors');

class SmartScheduler {
  constructor() {
    this.optimalTimes = {
      // Based on LinkedIn research data
      weekdays: {
        1: { // Monday
          times: ['08:00', '10:00', '12:00', '17:00'],
          engagement: 0.7
        },
        2: { // Tuesday
          times: ['09:00', '10:00', '11:00', '17:00', '18:00'],
          engagement: 0.9
        },
        3: { // Wednesday
          times: ['09:00', '10:00', '11:00', '17:00', '18:00'],
          engagement: 0.95
        },
        4: { // Thursday
          times: ['09:00', '10:00', '11:00', '17:00'],
          engagement: 0.85
        },
        5: { // Friday
          times: ['08:00', '09:00', '16:00'],
          engagement: 0.6
        }
      },
      timezone: 'UTC'
    };
  }

  /**
   * Calculate optimal publish time based on content and company data
   */
  async calculateOptimalTime(postId, companyId, preferredTime = null) {
    try {
      // Get company's historical performance data
      const performanceData = await this.getCompanyPerformanceData(companyId);
      
      // Get content type and audience data
      const contentData = await this.getPostContentData(postId);
      
      // If preferred time is provided, validate and use if reasonable
      if (preferredTime) {
        const preferredDate = new Date(preferredTime);
        if (this.isReasonableTime(preferredDate)) {
          logger.info('Using preferred publish time:', {
            postId,
            preferredTime,
            companyId
          });
          return preferredDate;
        }
      }

      // Calculate optimal time based on multiple factors
      const optimalTime = await this.calculateBestTime({
        performanceData,
        contentData,
        companyId,
        currentTime: new Date()
      });

      logger.info('Calculated optimal publish time:', {
        postId,
        optimalTime: optimalTime.toISOString(),
        factors: {
          historicalPerformance: performanceData ? 'available' : 'unavailable',
          contentType: contentData?.content_type,
          audienceTimezone: performanceData?.primary_timezone || 'UTC'
        }
      });

      return optimalTime;
    } catch (error) {
      logger.error('Failed to calculate optimal time:', {
        postId,
        companyId,
        error: error.message
      });
      
      // Fallback to next optimal time
      return this.getNextOptimalTime();
    }
  }

  /**
   * Get company's historical performance data
   */
  async getCompanyPerformanceData(companyId) {
    try {
      const performanceQuery = `
        SELECT 
          EXTRACT(DOW FROM published_at) as day_of_week,
          EXTRACT(HOUR FROM published_at) as hour_of_day,
          AVG(performance_score) as avg_performance,
          COUNT(*) as post_count,
          SUM(COALESCE(linkedin_metrics->>'impressions', '0')::int) as total_impressions,
          SUM(COALESCE(linkedin_metrics->>'likes', '0')::int) as total_likes,
          SUM(COALESCE(linkedin_metrics->>'comments', '0')::int) as total_comments,
          SUM(COALESCE(linkedin_metrics->>'shares', '0')::int) as total_shares
        FROM linkedin_posts 
        WHERE company_id = $1 
          AND status = 'published' 
          AND published_at >= NOW() - INTERVAL '90 days'
          AND performance_score IS NOT NULL
        GROUP BY day_of_week, hour_of_day
        HAVING COUNT(*) >= 2
        ORDER BY avg_performance DESC
      `;

      const result = await query(performanceQuery, [companyId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      // Process and structure the data
      const performance = {
        optimalDays: this.analyzeOptimalDays(result.rows),
        optimalHours: this.analyzeOptimalHours(result.rows),
        totalPosts: result.rows.reduce((sum, row) => sum + parseInt(row.post_count), 0),
        avgPerformance: this.calculateWeightedAverage(result.rows),
        primary_timezone: await this.getCompanyTimezone(companyId)
      };

      return performance;
    } catch (error) {
      logger.error('Failed to get performance data:', {
        companyId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * Get post content data for scheduling optimization
   */
  async getPostContentData(postId) {
    try {
      const contentQuery = `
        SELECT 
          p.post_content,
          cs.content_type,
          cs.metadata,
          c.target_audience,
          c.timezone,
          LENGTH(p.post_content) as content_length,
          array_length(p.hashtags, 1) as hashtag_count
        FROM linkedin_posts p
        LEFT JOIN content_sources cs ON p.content_source_id = cs.id
        LEFT JOIN companies c ON p.company_id = c.id
        WHERE p.id = $1
      `;

      const result = await query(contentQuery, [postId]);
      
      if (result.rows.length === 0) {
        throw new Error('Post not found');
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get content data:', {
        postId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Calculate the best time considering all factors
   */
  async calculateBestTime({ performanceData, contentData, companyId, currentTime }) {
    const now = new Date(currentTime);
    const companyTimezone = contentData?.timezone || 'UTC';
    
    // Get next 7 days of potential times
    const candidateTimes = this.generateCandidateTimes(now, 7, companyTimezone);
    
    // Score each candidate time
    const scoredTimes = candidateTimes.map(time => ({
      time,
      score: this.scoreTime(time, performanceData, contentData)
    }));

    // Sort by score and get the best time
    scoredTimes.sort((a, b) => b.score - a.score);
    
    const bestTime = scoredTimes[0];
    
    logger.debug('Time scoring results:', {
      companyId,
      topCandidates: scoredTimes.slice(0, 3).map(t => ({
        time: t.time.toISOString(),
        score: t.score
      }))
    });

    return bestTime.time;
  }

  /**
   * Generate candidate publish times for the next N days
   */
  generateCandidateTimes(startTime, days = 7, timezone = 'UTC') {
    const times = [];
    const start = new Date(startTime);
    
    // Ensure we start at least 1 hour from now
    if (start.getTime() <= Date.now() + (60 * 60 * 1000)) {
      start.setTime(Date.now() + (2 * 60 * 60 * 1000)); // 2 hours from now
    }

    for (let day = 0; day < days; day++) {
      const currentDay = new Date(start);
      currentDay.setDate(start.getDate() + day);
      
      const dayOfWeek = currentDay.getDay();
      
      // Skip weekends for B2B content
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        continue;
      }

      // Get optimal hours for this day
      const dayData = this.optimalTimes.weekdays[dayOfWeek];
      if (!dayData) continue;

      dayData.times.forEach(timeStr => {
        const [hour, minute] = timeStr.split(':').map(Number);
        const candidateTime = new Date(currentDay);
        candidateTime.setHours(hour, minute, 0, 0);
        
        // Only include future times
        if (candidateTime.getTime() > Date.now()) {
          times.push(candidateTime);
        }
      });
    }

    return times;
  }

  /**
   * Score a potential publish time
   */
  scoreTime(time, performanceData, contentData) {
    let score = 0;
    
    const dayOfWeek = time.getDay();
    const hour = time.getHours();
    
    // Base score from general optimal times
    const dayData = this.optimalTimes.weekdays[dayOfWeek];
    if (dayData) {
      score += dayData.engagement * 40;
      
      // Bonus for optimal hours
      const timeStr = `${hour.toString().padStart(2, '0')}:00`;
      if (dayData.times.includes(timeStr)) {
        score += 20;
      }
    }

    // Historical performance bonus
    if (performanceData) {
      const historicalMatch = this.findHistoricalMatch(time, performanceData);
      if (historicalMatch) {
        score += historicalMatch.avg_performance * 5;
      }
    }

    // Content type adjustments
    if (contentData) {
      score += this.getContentTypeBonus(contentData, time);
    }

    // Avoid posting too close to other scheduled posts
    score -= this.getFrequencyPenalty(time);

    // Slight preference for near-term posting (within 24 hours)
    const hoursFromNow = (time.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursFromNow <= 24) {
      score += Math.max(0, 10 - hoursFromNow);
    }

    return Math.max(0, score);
  }

  /**
   * Find historical performance for similar time
   */
  findHistoricalMatch(time, performanceData) {
    const dayOfWeek = time.getDay();
    const hour = time.getHours();
    
    return performanceData.optimalHours?.find(h => 
      h.day_of_week === dayOfWeek && Math.abs(h.hour_of_day - hour) <= 1
    );
  }

  /**
   * Get content type specific bonuses
   */
  getContentTypeBonus(contentData, time) {
    const hour = time.getHours();
    let bonus = 0;

    switch (contentData.content_type) {
      case 'meeting_transcript':
        // Meeting insights work well in morning
        if (hour >= 8 && hour <= 11) bonus += 5;
        break;
      case 'sales_call':
        // Sales content performs well mid-morning and late afternoon
        if ((hour >= 9 && hour <= 11) || (hour >= 16 && hour <= 18)) bonus += 5;
        break;
      case 'webinar':
        // Educational content works well mid-day
        if (hour >= 11 && hour <= 14) bonus += 5;
        break;
      case 'manual_input':
        // Manual content is usually timely, prefer sooner
        bonus += 3;
        break;
    }

    // Longer content gets slight morning preference
    if (contentData.content_length > 500 && hour >= 9 && hour <= 11) {
      bonus += 2;
    }

    return bonus;
  }

  /**
   * Calculate penalty for posting too frequently
   */
  getFrequencyPenalty(time) {
    // This would check database for nearby scheduled posts
    // For now, return minimal penalty
    return 0;
  }

  /**
   * Check if a time is reasonable (not too far in future, not in past, during business hours)
   */
  isReasonableTime(time) {
    const now = new Date();
    const hour = time.getHours();
    const dayOfWeek = time.getDay();
    
    // Must be in future but not more than 30 days out
    if (time <= now || time > new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
      return false;
    }
    
    // Should be during business hours (6 AM to 10 PM)
    if (hour < 6 || hour > 22) {
      return false;
    }
    
    // Weekends are okay but not optimal
    return true;
  }

  /**
   * Get next optimal time (fallback)
   */
  getNextOptimalTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    
    // Default to 10 AM next business day
    const nextBusinessDay = this.getNextBusinessDay(tomorrow);
    nextBusinessDay.setHours(10, 0, 0, 0);
    
    return nextBusinessDay;
  }

  /**
   * Get next business day
   */
  getNextBusinessDay(date) {
    const result = new Date(date);
    while (result.getDay() === 0 || result.getDay() === 6) {
      result.setDate(result.getDate() + 1);
    }
    return result;
  }

  /**
   * Analyze optimal days from performance data
   */
  analyzeOptimalDays(rows) {
    const dayPerformance = {};
    
    rows.forEach(row => {
      const day = parseInt(row.day_of_week);
      if (!dayPerformance[day]) {
        dayPerformance[day] = {
          totalScore: 0,
          totalPosts: 0
        };
      }
      
      dayPerformance[day].totalScore += parseFloat(row.avg_performance) * parseInt(row.post_count);
      dayPerformance[day].totalPosts += parseInt(row.post_count);
    });

    // Calculate weighted averages and sort
    return Object.entries(dayPerformance)
      .map(([day, data]) => ({
        day: parseInt(day),
        avgPerformance: data.totalScore / data.totalPosts,
        postCount: data.totalPosts
      }))
      .sort((a, b) => b.avgPerformance - a.avgPerformance);
  }

  /**
   * Analyze optimal hours from performance data
   */
  analyzeOptimalHours(rows) {
    return rows.map(row => ({
      day_of_week: parseInt(row.day_of_week),
      hour_of_day: parseInt(row.hour_of_day),
      avg_performance: parseFloat(row.avg_performance),
      post_count: parseInt(row.post_count)
    }));
  }

  /**
   * Calculate weighted average performance
   */
  calculateWeightedAverage(rows) {
    let totalWeightedScore = 0;
    let totalWeight = 0;
    
    rows.forEach(row => {
      const weight = parseInt(row.post_count);
      totalWeightedScore += parseFloat(row.avg_performance) * weight;
      totalWeight += weight;
    });
    
    return totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  }

  /**
   * Get company timezone
   */
  async getCompanyTimezone(companyId) {
    try {
      const result = await query(
        'SELECT timezone FROM companies WHERE id = $1',
        [companyId]
      );
      
      return result.rows[0]?.timezone || 'UTC';
    } catch (error) {
      logger.warn('Failed to get company timezone:', error.message);
      return 'UTC';
    }
  }
}

module.exports = SmartScheduler;