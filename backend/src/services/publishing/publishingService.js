/**
 * Marketing Machine - Publishing Service
 * Phase 7: Smart Publishing System
 */

const { query, transaction } = require('../../config/database');
const { publishingQueue } = require('../../config/queue');
const logger = require('../../utils/logger');
const LinkedInAPI = require('./linkedinAPI');
const SmartScheduler = require('./smartScheduler');
const { ValidationError, NotFoundError, UnauthorizedError } = require('../../utils/errors');

class PublishingService {
  constructor() {
    this.scheduler = new SmartScheduler();
  }

  /**
   * Schedule a post for publishing
   */
  async schedulePost(postId, companyId, userId, options = {}) {
    try {
      const {
        scheduledFor,
        autoPublish = false,
        useSmartScheduling = true,
        selectedImageId = null
      } = options;

      let publishTime;

      await transaction(async (client) => {
        // Get post details
        const postResult = await client.query(`
          SELECT 
            p.*,
            cs.content_type,
            c.linkedin_access_token,
            c.linkedin_page_id,
            c.name as company_name
          FROM linkedin_posts p
          LEFT JOIN content_sources cs ON p.content_source_id = cs.id
          LEFT JOIN companies c ON p.company_id = c.id
          WHERE p.id = $1 AND p.company_id = $2
        `, [postId, companyId]);

        if (postResult.rows.length === 0) {
          throw new NotFoundError('Post not found');
        }

        const post = postResult.rows[0];

        // Validate post status
        if (!['approved', 'approved_auto_publish'].includes(post.status)) {
          throw new ValidationError('Post must be approved before scheduling');
        }

        // Get LinkedIn credentials
        if (!post.linkedin_access_token) {
          throw new ValidationError('LinkedIn access token not configured for company');
        }

        // Determine optimal publish time
        if (useSmartScheduling && !scheduledFor) {
          publishTime = await this.scheduler.calculateOptimalTime(
            postId, companyId, scheduledFor
          );
        } else if (scheduledFor) {
          publishTime = new Date(scheduledFor);
        } else {
          publishTime = new Date(Date.now() + (60 * 60 * 1000)); // 1 hour from now
        }

        // Update post status and schedule time
        await client.query(`
          UPDATE linkedin_posts 
          SET 
            status = $1,
            scheduled_for = $2,
            scheduled_by = $3,
            scheduled_at = NOW(),
            updated_at = NOW()
          WHERE id = $4
        `, ['scheduled', publishTime, userId, postId]);

        // Get selected image if available
        let imageData = null;
        if (selectedImageId) {
          const imageResult = await client.query(
            'SELECT * FROM generated_images WHERE id = $1 AND post_id = $2',
            [selectedImageId, postId]
          );
          imageData = imageResult.rows[0] || null;
        } else {
          // Get the highest quality image
          const imageResult = await client.query(`
            SELECT * FROM generated_images 
            WHERE post_id = $1 AND selected = true
            ORDER BY quality_score DESC, brand_alignment DESC 
            LIMIT 1
          `, [postId]);
          imageData = imageResult.rows[0] || null;
        }

        // Schedule the publishing job
        const jobData = {
          postId,
          companyId,
          userId,
          publishTime: publishTime.toISOString(),
          postContent: post.post_content,
          hashtags: post.hashtags,
          imageData,
          linkedInToken: post.linkedin_access_token,
          companyName: post.company_name
        };

        // Calculate delay until publish time
        const delay = Math.max(0, publishTime.getTime() - Date.now());

        if (publishingQueue) {
          await publishingQueue.add('publish-to-linkedin', jobData, {
            delay,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 60000 // 1 minute
            },
            removeOnComplete: 10,
            removeOnFail: 5
          });

          logger.info('Post scheduled for publishing:', {
            postId,
            companyId,
            publishTime: publishTime.toISOString(),
            delay: delay / 1000 / 60, // minutes
            hasImage: !!imageData
          });
        } else {
          logger.warn('Publishing queue not available, marking as publish_pending');
          
          await client.query(`
            UPDATE linkedin_posts 
            SET status = 'publish_pending'
            WHERE id = $1
          `, [postId]);
        }

        // Record scheduling history
        await client.query(`
          INSERT INTO publishing_history 
          (post_id, company_id, user_id, action, scheduled_time, metadata, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [
          postId,
          companyId,
          userId,
          'scheduled',
          publishTime,
          {
            useSmartScheduling,
            autoPublish,
            hasImage: !!imageData,
            originalScheduledFor: scheduledFor
          }
        ]);
      });

      return {
        postId,
        scheduledFor: publishTime,
        message: 'Post scheduled for publishing successfully'
      };

    } catch (error) {
      logger.error('Failed to schedule post:', {
        postId,
        companyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute the publishing of a post to LinkedIn
   */
  async publishToLinkedIn(jobData) {
    const {
      postId,
      companyId,
      userId,
      postContent,
      hashtags,
      imageData,
      linkedInToken,
      companyName
    } = jobData;

    try {
      logger.info('Starting LinkedIn publishing process:', {
        postId,
        companyId,
        hasImage: !!imageData
      });

      // Initialize LinkedIn API client
      const linkedInAPI = new LinkedInAPI(linkedInToken, companyId);

      // Validate token before publishing
      const isValidToken = await linkedInAPI.validateToken();
      if (!isValidToken) {
        throw new UnauthorizedError('LinkedIn access token is invalid or expired');
      }

      // Prepare content
      let fullContent = postContent;
      if (hashtags && hashtags.length > 0) {
        fullContent += '\n\n' + hashtags.join(' ');
      }

      // Publish to LinkedIn
      let publishResult;
      if (imageData && imageData.url) {
        publishResult = await linkedInAPI.publishImagePost(
          fullContent,
          imageData.url,
          'PUBLIC'
        );
      } else {
        publishResult = await linkedInAPI.publishTextPost(
          fullContent,
          'PUBLIC'
        );
      }

      // Update post status and LinkedIn data
      await transaction(async (client) => {
        await client.query(`
          UPDATE linkedin_posts 
          SET 
            status = 'published',
            published_at = NOW(),
            linkedin_post_id = $1,
            linkedin_post_url = $2,
            updated_at = NOW()
          WHERE id = $3
        `, [
          publishResult.id,
          publishResult.url,
          postId
        ]);

        // Record publishing success
        await client.query(`
          INSERT INTO publishing_history 
          (post_id, company_id, user_id, action, linkedin_post_id, linkedin_post_url, metadata, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
          postId,
          companyId,
          userId,
          'published',
          publishResult.id,
          publishResult.url,
          {
            publishedAt: publishResult.publishedAt,
            hasImage: !!imageData,
            contentLength: fullContent.length
          }
        ]);
      });

      logger.info('Post published to LinkedIn successfully:', {
        postId,
        linkedInPostId: publishResult.id,
        linkedInUrl: publishResult.url
      });

      // Schedule analytics collection (after 24 hours)
      if (publishingQueue) {
        await publishingQueue.add('collect-linkedin-analytics', {
          postId,
          linkedInPostId: publishResult.id,
          companyId
        }, {
          delay: 24 * 60 * 60 * 1000, // 24 hours
          attempts: 2
        });
      }

      return {
        success: true,
        linkedInPostId: publishResult.id,
        linkedInUrl: publishResult.url,
        publishedAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to publish to LinkedIn:', {
        postId,
        companyId,
        error: error.message
      });

      // Update post status to failed
      await this.markPublishingFailed(postId, error.message);

      throw error;
    }
  }

  /**
   * Collect analytics for published posts
   */
  async collectAnalytics(postId, linkedInPostId, companyId) {
    try {
      // Get LinkedIn credentials
      const credentialsResult = await query(
        'SELECT linkedin_access_token FROM companies WHERE id = $1',
        [companyId]
      );

      if (credentialsResult.rows.length === 0) {
        throw new Error('Company not found');
      }

      const linkedInToken = credentialsResult.rows[0].linkedin_access_token;
      if (!linkedInToken) {
        throw new Error('LinkedIn token not available');
      }

      // Initialize LinkedIn API
      const linkedInAPI = new LinkedInAPI(linkedInToken, companyId);

      // Get post analytics
      const analytics = await linkedInAPI.getPostAnalytics(linkedInPostId);

      if (analytics) {
        // Update post with analytics data
        await query(`
          UPDATE linkedin_posts 
          SET 
            linkedin_metrics = $1,
            performance_score = COALESCE(
              (COALESCE($1->>'likes', '0')::int * 3) +
              (COALESCE($1->>'comments', '0')::int * 5) +
              (COALESCE($1->>'shares', '0')::int * 7) +
              (COALESCE($1->>'impressions', '0')::int * 0.01),
              performance_score
            ),
            updated_at = NOW()
          WHERE id = $2
        `, [
          JSON.stringify(analytics),
          postId
        ]);

        logger.info('Analytics collected for post:', {
          postId,
          linkedInPostId,
          analytics
        });
      }

    } catch (error) {
      logger.error('Failed to collect analytics:', {
        postId,
        linkedInPostId,
        error: error.message
      });
    }
  }

  /**
   * Cancel a scheduled post
   */
  async cancelScheduledPost(postId, companyId, userId) {
    try {
      await transaction(async (client) => {
        // Check if post can be cancelled
        const postResult = await client.query(
          'SELECT status, scheduled_for FROM linkedin_posts WHERE id = $1 AND company_id = $2',
          [postId, companyId]
        );

        if (postResult.rows.length === 0) {
          throw new NotFoundError('Post not found');
        }

        const post = postResult.rows[0];
        
        if (post.status !== 'scheduled') {
          throw new ValidationError('Only scheduled posts can be cancelled');
        }

        // Update post status
        await client.query(`
          UPDATE linkedin_posts 
          SET 
            status = 'approved',
            scheduled_for = NULL,
            scheduled_by = NULL,
            scheduled_at = NULL,
            updated_at = NOW()
          WHERE id = $1
        `, [postId]);

        // Record cancellation
        await client.query(`
          INSERT INTO publishing_history 
          (post_id, company_id, user_id, action, metadata, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [
          postId,
          companyId,
          userId,
          'cancelled',
          {
            originalScheduledFor: post.scheduled_for,
            cancelledAt: new Date().toISOString()
          }
        ]);
      });

      logger.info('Scheduled post cancelled:', {
        postId,
        companyId,
        userId
      });

      return { message: 'Scheduled post cancelled successfully' };

    } catch (error) {
      logger.error('Failed to cancel scheduled post:', {
        postId,
        companyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Mark publishing as failed
   */
  async markPublishingFailed(postId, errorMessage) {
    try {
      await query(`
        UPDATE linkedin_posts 
        SET 
          status = 'publish_failed',
          publishing_error = $1,
          updated_at = NOW()
        WHERE id = $2
      `, [errorMessage, postId]);

      logger.info('Post marked as publish failed:', {
        postId,
        error: errorMessage
      });
    } catch (error) {
      logger.error('Failed to mark publishing as failed:', {
        postId,
        error: error.message
      });
    }
  }

  /**
   * Get publishing statistics
   */
  async getPublishingStats(companyId, days = 30) {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled,
          COUNT(*) FILTER (WHERE status = 'published') as published,
          COUNT(*) FILTER (WHERE status = 'publish_failed') as failed,
          COUNT(*) FILTER (WHERE published_at >= NOW() - INTERVAL '${days} days') as recent_published,
          AVG(performance_score) FILTER (WHERE status = 'published' AND performance_score > 0) as avg_performance,
          SUM(COALESCE(linkedin_metrics->>'impressions', '0')::int) as total_impressions,
          SUM(COALESCE(linkedin_metrics->>'likes', '0')::int) as total_likes,
          SUM(COALESCE(linkedin_metrics->>'comments', '0')::int) as total_comments,
          SUM(COALESCE(linkedin_metrics->>'shares', '0')::int) as total_shares
        FROM linkedin_posts 
        WHERE company_id = $1
      `;

      const result = await query(statsQuery, [companyId]);
      const stats = result.rows[0];

      // Convert string numbers to integers
      Object.keys(stats).forEach(key => {
        if (stats[key] && !isNaN(stats[key]) && key !== 'avg_performance') {
          stats[key] = parseInt(stats[key]);
        }
      });

      stats.avg_performance = parseFloat(stats.avg_performance || 0);
      stats.period_days = parseInt(days);

      return stats;

    } catch (error) {
      logger.error('Failed to get publishing stats:', {
        companyId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get scheduled posts
   */
  async getScheduledPosts(companyId, limit = 20) {
    try {
      const query_text = `
        SELECT 
          p.id,
          p.uuid,
          p.post_content,
          p.hashtags,
          p.scheduled_for,
          p.scheduled_at,
          p.performance_score,
          cs.title as source_title,
          cs.content_type,
          u.name as scheduled_by_name,
          (
            SELECT json_agg(
              json_build_object(
                'id', i.id,
                'url', i.url,
                'selected', i.selected
              )
            )
            FROM generated_images i 
            WHERE i.post_id = p.id AND i.selected = true
          ) as selected_images
        FROM linkedin_posts p
        LEFT JOIN content_sources cs ON p.content_source_id = cs.id
        LEFT JOIN users u ON p.scheduled_by = u.id
        WHERE p.company_id = $1 
          AND p.status = 'scheduled'
          AND p.scheduled_for > NOW()
        ORDER BY p.scheduled_for ASC
        LIMIT $2
      `;

      const result = await query(query_text, [companyId, limit]);

      return result.rows;

    } catch (error) {
      logger.error('Failed to get scheduled posts:', {
        companyId,
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = PublishingService;