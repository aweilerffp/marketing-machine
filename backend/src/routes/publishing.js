/**
 * Marketing Machine - Publishing Routes
 * Phase 7: Smart Publishing System
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const PublishingService = require('../services/publishing/publishingService');
const { ValidationError, NotFoundError, UnauthorizedError } = require('../utils/errors');
const logger = require('../utils/logger');

const publishingService = new PublishingService();

/**
 * Schedule a post for publishing
 * POST /api/publishing/schedule
 */
router.post('/schedule', authenticateToken, async (req, res) => {
  try {
    const { companyId, userId } = req.user;
    const {
      postId,
      scheduledFor,
      autoPublish = false,
      useSmartScheduling = true,
      selectedImageId
    } = req.body;

    if (!postId) {
      throw new ValidationError('Post ID is required');
    }

    const result = await publishingService.schedulePost(
      postId,
      companyId,
      userId,
      {
        scheduledFor,
        autoPublish,
        useSmartScheduling,
        selectedImageId
      }
    );

    res.json(result);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return res.status(400).json({ error: error.message });
    }
    
    logger.error('Error scheduling post:', error);
    res.status(500).json({ error: 'Failed to schedule post' });
  }
});

/**
 * Cancel a scheduled post
 * DELETE /api/publishing/schedule/:postId
 */
router.delete('/schedule/:postId', authenticateToken, async (req, res) => {
  try {
    const { companyId, userId } = req.user;
    const { postId } = req.params;

    const result = await publishingService.cancelScheduledPost(
      postId,
      companyId,
      userId
    );

    res.json(result);
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return res.status(400).json({ error: error.message });
    }
    
    logger.error('Error cancelling scheduled post:', error);
    res.status(500).json({ error: 'Failed to cancel scheduled post' });
  }
});

/**
 * Get scheduled posts
 * GET /api/publishing/scheduled
 */
router.get('/scheduled', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.user;
    const { limit = 20 } = req.query;

    const posts = await publishingService.getScheduledPosts(
      companyId,
      parseInt(limit)
    );

    res.json({ posts });
  } catch (error) {
    logger.error('Error fetching scheduled posts:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled posts' });
  }
});

/**
 * Get publishing statistics
 * GET /api/publishing/stats
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.user;
    const { days = 30 } = req.query;

    const stats = await publishingService.getPublishingStats(
      companyId,
      parseInt(days)
    );

    res.json(stats);
  } catch (error) {
    logger.error('Error fetching publishing stats:', error);
    res.status(500).json({ error: 'Failed to fetch publishing stats' });
  }
});

/**
 * Manual publish (immediate)
 * POST /api/publishing/publish-now
 */
router.post('/publish-now', authenticateToken, async (req, res) => {
  try {
    const { companyId, userId } = req.user;
    const { postId, selectedImageId } = req.body;

    if (!postId) {
      throw new ValidationError('Post ID is required');
    }

    // Schedule for immediate publishing (1 minute delay)
    const immediateTime = new Date(Date.now() + 60 * 1000);
    
    const result = await publishingService.schedulePost(
      postId,
      companyId,
      userId,
      {
        scheduledFor: immediateTime.toISOString(),
        autoPublish: true,
        useSmartScheduling: false,
        selectedImageId
      }
    );

    res.json({
      ...result,
      message: 'Post queued for immediate publishing'
    });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return res.status(400).json({ error: error.message });
    }
    
    logger.error('Error publishing post immediately:', error);
    res.status(500).json({ error: 'Failed to publish post immediately' });
  }
});

/**
 * Get optimal publishing time for a post
 * GET /api/publishing/optimal-time/:postId
 */
router.get('/optimal-time/:postId', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.user;
    const { postId } = req.params;
    const { preferredTime } = req.query;

    const optimalTime = await publishingService.scheduler.calculateOptimalTime(
      postId,
      companyId,
      preferredTime
    );

    res.json({
      optimalTime: optimalTime.toISOString(),
      timezone: 'UTC',
      confidence: 'high'
    });
  } catch (error) {
    logger.error('Error calculating optimal time:', error);
    res.status(500).json({ error: 'Failed to calculate optimal time' });
  }
});

/**
 * Webhook endpoint for queue job updates (internal use)
 * POST /api/publishing/webhook/job-update
 */
router.post('/webhook/job-update', async (req, res) => {
  try {
    const { jobId, status, result, error } = req.body;

    logger.info('Publishing job update received:', {
      jobId,
      status,
      hasResult: !!result,
      hasError: !!error
    });

    // This could be used to update UI in real-time
    // For now, just acknowledge receipt
    res.json({ received: true });
  } catch (error) {
    logger.error('Error processing job update webhook:', error);
    res.status(500).json({ error: 'Failed to process job update' });
  }
});

module.exports = router;