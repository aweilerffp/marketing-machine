/**
 * Marketing Machine - Publishing Queue Processors
 * Phase 7: Smart Publishing System
 */

const PublishingService = require('./publishingService');
const logger = require('../../utils/logger');

const publishingService = new PublishingService();

/**
 * Process LinkedIn publishing jobs
 */
const processLinkedInPublishing = async (job) => {
  const { postId, companyId } = job.data;
  
  try {
    logger.info('Processing LinkedIn publishing job:', {
      jobId: job.id,
      postId,
      companyId
    });

    const result = await publishingService.publishToLinkedIn(job.data);

    logger.info('LinkedIn publishing job completed successfully:', {
      jobId: job.id,
      postId,
      linkedInPostId: result.linkedInPostId
    });

    return result;
  } catch (error) {
    logger.error('LinkedIn publishing job failed:', {
      jobId: job.id,
      postId,
      companyId,
      error: error.message
    });

    // Don't retry certain errors
    if (error.name === 'UnauthorizedError') {
      throw new Error(`LinkedIn authentication failed: ${error.message}`);
    }

    if (error.name === 'ValidationError') {
      throw new Error(`Validation failed: ${error.message}`);
    }

    // Retry other errors
    throw error;
  }
};

/**
 * Process analytics collection jobs
 */
const processAnalyticsCollection = async (job) => {
  const { postId, linkedInPostId, companyId } = job.data;
  
  try {
    logger.info('Processing analytics collection job:', {
      jobId: job.id,
      postId,
      linkedInPostId
    });

    await publishingService.collectAnalytics(postId, linkedInPostId, companyId);

    logger.info('Analytics collection completed:', {
      jobId: job.id,
      postId,
      linkedInPostId
    });

    return { success: true };
  } catch (error) {
    logger.error('Analytics collection job failed:', {
      jobId: job.id,
      postId,
      linkedInPostId,
      error: error.message
    });

    // Don't retry if token is invalid
    if (error.message.includes('token')) {
      throw new Error(`Analytics collection failed: ${error.message}`);
    }

    throw error;
  }
};

/**
 * Process batch publishing jobs
 */
const processBatchPublishing = async (job) => {
  const { postIds, companyId, userId } = job.data;
  
  try {
    logger.info('Processing batch publishing job:', {
      jobId: job.id,
      postCount: postIds.length,
      companyId
    });

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const postId of postIds) {
      try {
        // Add individual publishing jobs with staggered delays
        const delay = results.length * 5 * 60 * 1000; // 5 minutes apart
        
        const individualResult = await publishingService.schedulePost(
          postId,
          companyId,
          userId,
          {
            scheduledFor: new Date(Date.now() + delay).toISOString(),
            autoPublish: true,
            useSmartScheduling: true
          }
        );

        results.push({
          postId,
          success: true,
          scheduledFor: individualResult.scheduledFor
        });
        successCount++;
      } catch (error) {
        results.push({
          postId,
          success: false,
          error: error.message
        });
        failureCount++;
        
        logger.error('Failed to schedule post in batch:', {
          postId,
          error: error.message
        });
      }
    }

    logger.info('Batch publishing job completed:', {
      jobId: job.id,
      totalPosts: postIds.length,
      successCount,
      failureCount
    });

    return {
      results,
      summary: {
        total: postIds.length,
        successful: successCount,
        failed: failureCount
      }
    };
  } catch (error) {
    logger.error('Batch publishing job failed:', {
      jobId: job.id,
      postCount: postIds?.length || 0,
      error: error.message
    });

    throw error;
  }
};

/**
 * Process content performance analysis
 */
const processPerformanceAnalysis = async (job) => {
  const { companyId, timeframe = '30d' } = job.data;
  
  try {
    logger.info('Processing performance analysis job:', {
      jobId: job.id,
      companyId,
      timeframe
    });

    const stats = await publishingService.getPublishingStats(
      companyId,
      timeframe === '30d' ? 30 : timeframe === '7d' ? 7 : 90
    );

    // This could trigger insights generation, recommendations, etc.
    logger.info('Performance analysis completed:', {
      jobId: job.id,
      companyId,
      avgPerformance: stats.avg_performance,
      totalPublished: stats.published
    });

    return stats;
  } catch (error) {
    logger.error('Performance analysis job failed:', {
      jobId: job.id,
      companyId,
      error: error.message
    });

    throw error;
  }
};

module.exports = {
  processLinkedInPublishing,
  processAnalyticsCollection,
  processBatchPublishing,
  processPerformanceAnalysis
};