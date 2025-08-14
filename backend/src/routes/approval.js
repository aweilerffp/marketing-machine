/**
 * Marketing Machine - Approval Routes
 * Phase 6: In-App Approval Workflow
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { query, transaction } = require('../config/database');
const { ValidationError, NotFoundError, UnauthorizedError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Get pending posts for approval
 * GET /api/approval/pending
 */
router.get('/pending', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.user;
    const { page = 1, limit = 20, content_type, status = 'pending_approval' } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE p.company_id = $1 AND p.status = $2';
    let params = [companyId, status];
    
    if (content_type) {
      whereClause += ' AND cs.content_type = $3';
      params.push(content_type);
    }

    const postsQuery = `
      SELECT 
        p.id,
        p.uuid,
        p.post_content,
        p.hashtags,
        p.performance_score,
        p.status,
        p.scheduled_for,
        p.created_at,
        p.updated_at,
        cs.title as source_title,
        cs.content_type,
        cs.original_content,
        u.name as created_by_name,
        (
          SELECT json_agg(
            json_build_object(
              'id', i.id,
              'url', i.url,
              'model', i.model,
              'quality_score', i.quality_score,
              'brand_alignment', i.brand_alignment,
              'selected', i.selected
            )
          )
          FROM generated_images i 
          WHERE i.post_id = p.id
        ) as images,
        (
          SELECT json_agg(
            json_build_object(
              'id', h.id,
              'hook_text', h.hook_text,
              'score', h.score,
              'hook_type', h.hook_type,
              'selected', h.selected
            )
          )
          FROM marketing_hooks h 
          WHERE h.post_id = p.id
          ORDER BY h.score DESC
        ) as hooks
      FROM linkedin_posts p
      LEFT JOIN content_sources cs ON p.content_source_id = cs.id
      LEFT JOIN users u ON p.created_by = u.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM linkedin_posts p
      LEFT JOIN content_sources cs ON p.content_source_id = cs.id
      ${whereClause}
    `;

    const [postsResult, countResult] = await Promise.all([
      query(postsQuery, params),
      query(countQuery, params.slice(0, -2))
    ]);

    const posts = postsResult.rows;
    const total = parseInt(countResult.rows[0].total);

    res.json({
      posts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    logger.error('Error fetching pending posts:', error);
    res.status(500).json({ error: 'Failed to fetch pending posts' });
  }
});

/**
 * Get single post for detailed review
 * GET /api/approval/posts/:postId
 */
router.get('/posts/:postId', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.user;
    const { postId } = req.params;

    const postQuery = `
      SELECT 
        p.*,
        cs.title as source_title,
        cs.content_type,
        cs.original_content,
        cs.metadata as source_metadata,
        u.name as created_by_name,
        u.email as created_by_email,
        c.name as company_name,
        c.brand_voice,
        c.target_audience
      FROM linkedin_posts p
      LEFT JOIN content_sources cs ON p.content_source_id = cs.id
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE p.id = $1 AND p.company_id = $2
    `;

    const imagesQuery = `
      SELECT * FROM generated_images 
      WHERE post_id = $1 
      ORDER BY quality_score DESC, brand_alignment DESC
    `;

    const hooksQuery = `
      SELECT * FROM marketing_hooks 
      WHERE post_id = $1 
      ORDER BY score DESC
    `;

    const historyQuery = `
      SELECT 
        ah.*,
        u.name as user_name
      FROM approval_history ah
      LEFT JOIN users u ON ah.user_id = u.id
      WHERE ah.post_id = $1
      ORDER BY ah.created_at DESC
    `;

    const [postResult, imagesResult, hooksResult, historyResult] = await Promise.all([
      query(postQuery, [postId, companyId]),
      query(imagesQuery, [postId]),
      query(hooksQuery, [postId]),
      query(historyQuery, [postId])
    ]);

    if (postResult.rows.length === 0) {
      throw new NotFoundError('Post not found');
    }

    const post = {
      ...postResult.rows[0],
      images: imagesResult.rows,
      hooks: hooksResult.rows,
      approval_history: historyResult.rows
    };

    res.json(post);

  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    logger.error('Error fetching post details:', error);
    res.status(500).json({ error: 'Failed to fetch post details' });
  }
});

/**
 * Approve a post
 * POST /api/approval/posts/:postId/approve
 */
router.post('/posts/:postId/approve', authenticateToken, async (req, res) => {
  try {
    const { companyId, userId } = req.user;
    const { postId } = req.params;
    const { 
      scheduled_for, 
      selected_image_id,
      notes,
      auto_publish = false 
    } = req.body;

    await transaction(async (client) => {
      // Verify post belongs to company
      const postCheck = await client.query(
        'SELECT id, status FROM linkedin_posts WHERE id = $1 AND company_id = $2',
        [postId, companyId]
      );

      if (postCheck.rows.length === 0) {
        throw new NotFoundError('Post not found');
      }

      if (postCheck.rows[0].status !== 'pending_approval') {
        throw new ValidationError('Post is not pending approval');
      }

      // Update post status
      const newStatus = auto_publish ? 'approved_auto_publish' : 'approved';
      await client.query(
        `UPDATE linkedin_posts 
         SET status = $1, 
             approved_by = $2, 
             approved_at = NOW(), 
             scheduled_for = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [newStatus, userId, scheduled_for, postId]
      );

      // Update selected image if provided
      if (selected_image_id) {
        await client.query(
          'UPDATE generated_images SET selected = false WHERE post_id = $1',
          [postId]
        );
        await client.query(
          'UPDATE generated_images SET selected = true WHERE id = $1 AND post_id = $2',
          [selected_image_id, postId]
        );
      }

      // Record approval in history
      await client.query(
        `INSERT INTO approval_history 
         (post_id, user_id, action, notes, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [postId, userId, 'approved', notes]
      );

      // If auto-publish, add to publishing queue
      if (auto_publish) {
        try {
          const { publishingQueue } = require('../config/queue');
          if (publishingQueue && publishingQueue.add) {
            await publishingQueue.add('publish-post', {
              postId,
              companyId,
              userId,
              scheduled_for: scheduled_for || new Date()
            });
          }
        } catch (queueError) {
          logger.warn('Queue unavailable for auto-publish:', queueError.message);
        }
      }
    });

    logger.info(`Post ${postId} approved by user ${userId}`);
    res.json({ message: 'Post approved successfully' });

  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Error approving post:', error);
    res.status(500).json({ error: 'Failed to approve post' });
  }
});

/**
 * Reject a post
 * POST /api/approval/posts/:postId/reject
 */
router.post('/posts/:postId/reject', authenticateToken, async (req, res) => {
  try {
    const { companyId, userId } = req.user;
    const { postId } = req.params;
    const { notes, regenerate = false } = req.body;

    await transaction(async (client) => {
      // Verify post belongs to company
      const postCheck = await client.query(
        'SELECT id, status, content_source_id FROM linkedin_posts WHERE id = $1 AND company_id = $2',
        [postId, companyId]
      );

      if (postCheck.rows.length === 0) {
        throw new NotFoundError('Post not found');
      }

      if (postCheck.rows[0].status !== 'pending_approval') {
        throw new ValidationError('Post is not pending approval');
      }

      // Update post status
      const newStatus = regenerate ? 'regenerating' : 'rejected';
      await client.query(
        `UPDATE linkedin_posts 
         SET status = $1, 
             rejected_by = $2, 
             rejected_at = NOW(),
             updated_at = NOW()
         WHERE id = $3`,
        [newStatus, userId, postId]
      );

      // Record rejection in history
      await client.query(
        `INSERT INTO approval_history 
         (post_id, user_id, action, notes, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [postId, userId, 'rejected', notes]
      );

      // If regenerate requested, add to processing queue
      if (regenerate) {
        try {
          const { contentQueue } = require('../config/queue');
          if (contentQueue && contentQueue.add) {
            await contentQueue.add('regenerate-post', {
              postId,
              contentSourceId: postCheck.rows[0].content_source_id,
              companyId,
              userId,
              previousRejectionNotes: notes
            });
          }
        } catch (queueError) {
          logger.warn('Queue unavailable for regeneration:', queueError.message);
        }
      }
    });

    logger.info(`Post ${postId} rejected by user ${userId}${regenerate ? ' - regeneration requested' : ''}`);
    res.json({ message: 'Post rejected successfully' });

  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Error rejecting post:', error);
    res.status(500).json({ error: 'Failed to reject post' });
  }
});

/**
 * Edit post content
 * PUT /api/approval/posts/:postId
 */
router.put('/posts/:postId', authenticateToken, async (req, res) => {
  try {
    const { companyId, userId } = req.user;
    const { postId } = req.params;
    const { 
      post_content, 
      hashtags, 
      scheduled_for,
      notes 
    } = req.body;

    if (!post_content || post_content.trim().length === 0) {
      throw new ValidationError('Post content is required');
    }

    if (post_content.length > 3000) {
      throw new ValidationError('Post content too long (max 3000 characters)');
    }

    await transaction(async (client) => {
      // Verify post belongs to company and is editable
      const postCheck = await client.query(
        'SELECT id, status, post_content FROM linkedin_posts WHERE id = $1 AND company_id = $2',
        [postId, companyId]
      );

      if (postCheck.rows.length === 0) {
        throw new NotFoundError('Post not found');
      }

      const validStatuses = ['pending_approval', 'approved', 'draft'];
      if (!validStatuses.includes(postCheck.rows[0].status)) {
        throw new ValidationError('Post cannot be edited in current status');
      }

      // Update post
      await client.query(
        `UPDATE linkedin_posts 
         SET post_content = $1, 
             hashtags = $2,
             scheduled_for = $3,
             updated_at = NOW(),
             last_modified_by = $4
         WHERE id = $5`,
        [post_content.trim(), hashtags || [], scheduled_for, userId, postId]
      );

      // Record edit in history
      await client.query(
        `INSERT INTO approval_history 
         (post_id, user_id, action, notes, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [postId, userId, 'edited', notes, {
          previous_content: postCheck.rows[0].post_content,
          new_content: post_content.trim()
        }]
      );
    });

    logger.info(`Post ${postId} edited by user ${userId}`);
    res.json({ message: 'Post updated successfully' });

  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Error editing post:', error);
    res.status(500).json({ error: 'Failed to edit post' });
  }
});

/**
 * Get approval stats
 * GET /api/approval/stats
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { companyId } = req.user;
    const { days = 30 } = req.query;

    const statsQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending_approval') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'published') as published,
        AVG(performance_score) FILTER (WHERE status IN ('approved', 'published')) as avg_performance_score,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '${days} days') as recent_total
      FROM linkedin_posts 
      WHERE company_id = $1
    `;

    const approvalTimeQuery = `
      SELECT 
        AVG(EXTRACT(EPOCH FROM (approved_at - created_at))/3600) as avg_approval_time_hours
      FROM linkedin_posts 
      WHERE company_id = $1 
        AND approved_at IS NOT NULL 
        AND created_at >= NOW() - INTERVAL '${days} days'
    `;

    const [statsResult, timeResult] = await Promise.all([
      query(statsQuery, [companyId]),
      query(approvalTimeQuery, [companyId])
    ]);

    const stats = {
      ...statsResult.rows[0],
      avg_approval_time_hours: parseFloat(timeResult.rows[0]?.avg_approval_time_hours || 0),
      period_days: parseInt(days)
    };

    // Convert string numbers to integers
    Object.keys(stats).forEach(key => {
      if (key !== 'avg_performance_score' && key !== 'avg_approval_time_hours' && key !== 'period_days') {
        stats[key] = parseInt(stats[key] || 0);
      }
    });

    res.json(stats);

  } catch (error) {
    logger.error('Error fetching approval stats:', error);
    res.status(500).json({ error: 'Failed to fetch approval stats' });
  }
});

module.exports = router;