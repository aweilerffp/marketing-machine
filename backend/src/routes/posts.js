/**
 * Marketing Machine - LinkedIn Posts Routes
 * Management of generated LinkedIn posts
 */

const express = require('express');
const { query, transaction } = require('../config/database');
const { processContent } = require('../services/ai/contentProcessor');
const PostGenerator = require('../services/ai/postGenerator');
const logger = require('../utils/logger').api;
const { ValidationError } = require('../middleware/errorHandler');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// =============================================
// LINKEDIN POST GENERATION ROUTES
// =============================================

/**
 * Generate LinkedIn posts from marketing hooks
 */
router.post('/generate', [
  body('hook_ids').isArray().withMessage('Hook IDs must be an array').notEmpty().withMessage('At least one hook ID required'),
  body('hook_ids.*').isInt().withMessage('Hook IDs must be integers'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid post generation request', errors.array());
    }

    const { companyId } = req.user;
    const { hook_ids } = req.body;

    logger.info('LinkedIn post generation requested', {
      companyId,
      hookIds: hook_ids,
      hookCount: hook_ids.length
    });

    // Verify hooks belong to company
    const hookCheck = await query(`
      SELECT id FROM marketing_hooks 
      WHERE id = ANY($1) AND company_id = $2
    `, [hook_ids, companyId]);

    if (hookCheck.rows.length !== hook_ids.length) {
      return res.status(403).json({ 
        error: 'Some hooks not found or access denied',
        found: hookCheck.rows.length,
        requested: hook_ids.length
      });
    }

    // Generate posts
    const result = await processContent.generatePosts(hook_ids, companyId);

    logger.info('LinkedIn posts generated successfully', {
      companyId,
      postsGenerated: result.postsGenerated
    });

    res.json({
      success: true,
      message: `Generated ${result.postsGenerated} LinkedIn posts`,
      posts_generated: result.postsGenerated,
      posts: result.posts
    });

  } catch (error) {
    logger.error('LinkedIn post generation error', {
      error: error.message,
      companyId: req.user?.companyId,
      hookIds: req.body?.hook_ids
    });

    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, details: error.details });
    } else {
      res.status(500).json({ error: 'Failed to generate LinkedIn posts' });
    }
  }
});

/**
 * Get all LinkedIn posts for company
 */
router.get('/', async (req, res) => {
  try {
    const { companyId } = req.user;
    const { 
      status, 
      limit = 20, 
      offset = 0,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    let whereClause = 'WHERE lp.company_id = $1';
    const params = [companyId];

    if (status) {
      whereClause += ' AND lp.status = $2';
      params.push(status);
    }

    const validSorts = ['created_at', 'performance_score', 'brand_alignment_score', 'character_count'];
    const sortBy = validSorts.includes(sort_by) ? sort_by : 'created_at';
    const sortOrder = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const result = await query(`
      SELECT 
        lp.id,
        lp.uuid,
        lp.post_content,
        lp.character_count,
        lp.hashtags,
        lp.engagement_hooks,
        lp.cta_type,
        lp.performance_score,
        lp.brand_alignment_score,
        lp.status,
        lp.created_at,
        lp.updated_at,
        lp.scheduled_for,
        lp.published_at,
        mh.hook_text,
        mh.hook_type,
        mh.content_pillar
      FROM linkedin_posts lp
      JOIN marketing_hooks mh ON mh.id = lp.marketing_hook_id
      ${whereClause}
      ORDER BY lp.${sortBy} ${sortOrder}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM linkedin_posts lp
      ${whereClause}
    `, params);

    res.json({
      posts: result.rows.map(post => ({
        id: post.id,
        uuid: post.uuid,
        post_content: post.post_content,
        character_count: post.character_count,
        hashtags: post.hashtags,
        engagement_hooks: post.engagement_hooks,
        cta_type: post.cta_type,
        performance_score: post.performance_score,
        brand_alignment_score: post.brand_alignment_score,
        status: post.status,
        hook: {
          text: post.hook_text,
          type: post.hook_type,
          content_pillar: post.content_pillar
        },
        timestamps: {
          created_at: post.created_at,
          updated_at: post.updated_at,
          scheduled_for: post.scheduled_for,
          published_at: post.published_at
        }
      })),
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: parseInt(offset) + parseInt(limit) < parseInt(countResult.rows[0].total)
      }
    });

  } catch (error) {
    logger.error('Get LinkedIn posts error', {
      error: error.message,
      companyId: req.user?.companyId
    });
    res.status(500).json({ error: 'Failed to fetch LinkedIn posts' });
  }
});

/**
 * Get single LinkedIn post
 */
router.get('/:id', async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    const result = await query(`
      SELECT 
        lp.*,
        mh.hook_text,
        mh.hook_type,
        mh.content_pillar,
        mh.source_quote,
        mh.relevance_score,
        mh.engagement_prediction
      FROM linkedin_posts lp
      JOIN marketing_hooks mh ON mh.id = lp.marketing_hook_id
      WHERE lp.id = $1 AND lp.company_id = $2
    `, [id, companyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'LinkedIn post not found' });
    }

    const post = result.rows[0];

    res.json({
      id: post.id,
      uuid: post.uuid,
      post_content: post.post_content,
      character_count: post.character_count,
      hashtags: post.hashtags,
      engagement_hooks: post.engagement_hooks,
      cta_type: post.cta_type,
      performance_score: post.performance_score,
      brand_alignment_score: post.brand_alignment_score,
      status: post.status,
      hook: {
        id: post.marketing_hook_id,
        text: post.hook_text,
        type: post.hook_type,
        content_pillar: post.content_pillar,
        source_quote: post.source_quote,
        relevance_score: post.relevance_score,
        engagement_prediction: post.engagement_prediction
      },
      metadata: post.metadata,
      timestamps: {
        created_at: post.created_at,
        updated_at: post.updated_at,
        scheduled_for: post.scheduled_for,
        published_at: post.published_at
      }
    });

  } catch (error) {
    logger.error('Get LinkedIn post error', {
      error: error.message,
      postId: req.params.id,
      companyId: req.user?.companyId
    });
    res.status(500).json({ error: 'Failed to fetch LinkedIn post' });
  }
});

/**
 * Update LinkedIn post
 */
router.put('/:id', [
  body('post_content').optional().isLength({ min: 50, max: 3000 }).withMessage('Post content must be 50-3000 characters'),
  body('status').optional().isIn(['draft', 'approved', 'scheduled', 'published', 'archived']).withMessage('Invalid status'),
  body('scheduled_for').optional().isISO8601().withMessage('Invalid scheduled date format'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid update data', errors.array());
    }

    const { companyId } = req.user;
    const { id } = req.params;
    const updates = req.body;

    // Verify post belongs to company
    const postCheck = await query(`
      SELECT id FROM linkedin_posts 
      WHERE id = $1 AND company_id = $2
    `, [id, companyId]);

    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'LinkedIn post not found' });
    }

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (['post_content', 'status', 'scheduled_for', 'hashtags', 'engagement_hooks', 'cta_type'].includes(key)) {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : value);
        paramCount++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // Recalculate character count if content changed
    if (updates.post_content) {
      updateFields.push(`character_count = $${paramCount}`);
      values.push(updates.post_content.length);
      paramCount++;
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(id, companyId);

    const result = await query(`
      UPDATE linkedin_posts 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND company_id = $${paramCount + 1}
      RETURNING *
    `, values);

    logger.info('LinkedIn post updated', {
      postId: id,
      companyId,
      updates: Object.keys(updates)
    });

    res.json({
      success: true,
      message: 'LinkedIn post updated successfully',
      post: {
        id: result.rows[0].id,
        status: result.rows[0].status,
        character_count: result.rows[0].character_count,
        updated_at: result.rows[0].updated_at
      }
    });

  } catch (error) {
    logger.error('Update LinkedIn post error', {
      error: error.message,
      postId: req.params.id,
      companyId: req.user?.companyId
    });

    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, details: error.details });
    } else {
      res.status(500).json({ error: 'Failed to update LinkedIn post' });
    }
  }
});

/**
 * Delete LinkedIn post
 */
router.delete('/:id', async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    // Prevent deletion of published posts
    const postCheck = await query(`
      SELECT id, status FROM linkedin_posts 
      WHERE id = $1 AND company_id = $2
    `, [id, companyId]);

    if (postCheck.rows.length === 0) {
      return res.status(404).json({ error: 'LinkedIn post not found' });
    }

    if (postCheck.rows[0].status === 'published') {
      return res.status(400).json({ error: 'Cannot delete published posts' });
    }

    await query(`
      DELETE FROM linkedin_posts 
      WHERE id = $1 AND company_id = $2
    `, [id, companyId]);

    logger.info('LinkedIn post deleted', { postId: id, companyId });

    res.json({
      success: true,
      message: 'LinkedIn post deleted successfully'
    });

  } catch (error) {
    logger.error('Delete LinkedIn post error', {
      error: error.message,
      postId: req.params.id,
      companyId: req.user?.companyId
    });
    res.status(500).json({ error: 'Failed to delete LinkedIn post' });
  }
});

// =============================================
// BULK OPERATIONS
// =============================================

/**
 * Bulk update post statuses
 */
router.post('/bulk/status', [
  body('post_ids').isArray().withMessage('Post IDs must be an array').notEmpty().withMessage('At least one post ID required'),
  body('post_ids.*').isInt().withMessage('Post IDs must be integers'),
  body('status').isIn(['draft', 'approved', 'scheduled', 'published', 'archived']).withMessage('Invalid status'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid bulk update request', errors.array());
    }

    const { companyId } = req.user;
    const { post_ids, status } = req.body;

    // Verify posts belong to company
    const postCheck = await query(`
      SELECT id FROM linkedin_posts 
      WHERE id = ANY($1) AND company_id = $2
    `, [post_ids, companyId]);

    if (postCheck.rows.length !== post_ids.length) {
      return res.status(403).json({ 
        error: 'Some posts not found or access denied',
        found: postCheck.rows.length,
        requested: post_ids.length
      });
    }

    // Update posts
    const result = await query(`
      UPDATE linkedin_posts 
      SET status = $1, updated_at = NOW()
      WHERE id = ANY($2) AND company_id = $3
      RETURNING id
    `, [status, post_ids, companyId]);

    logger.info('Bulk status update completed', {
      companyId,
      status,
      updatedCount: result.rows.length
    });

    res.json({
      success: true,
      message: `Updated ${result.rows.length} posts to ${status}`,
      updated_count: result.rows.length
    });

  } catch (error) {
    logger.error('Bulk status update error', {
      error: error.message,
      companyId: req.user?.companyId
    });

    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, details: error.details });
    } else {
      res.status(500).json({ error: 'Failed to update post statuses' });
    }
  }
});

// =============================================
// ANALYTICS AND STATS
// =============================================

/**
 * Get LinkedIn post statistics
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const { companyId } = req.user;

    const postGenerator = new PostGenerator();
    const stats = await postGenerator.getStats(companyId);

    // Get status breakdown
    const statusResult = await query(`
      SELECT status, COUNT(*) as count
      FROM linkedin_posts
      WHERE company_id = $1
      GROUP BY status
    `, [companyId]);

    const statusBreakdown = {};
    statusResult.rows.forEach(row => {
      statusBreakdown[row.status] = parseInt(row.count);
    });

    // Get recent activity
    const recentResult = await query(`
      SELECT DATE(created_at) as date, COUNT(*) as posts_created
      FROM linkedin_posts
      WHERE company_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, [companyId]);

    res.json({
      overview: stats,
      status_breakdown: statusBreakdown,
      recent_activity: recentResult.rows.map(row => ({
        date: row.date,
        posts_created: parseInt(row.posts_created)
      }))
    });

  } catch (error) {
    logger.error('Get LinkedIn post stats error', {
      error: error.message,
      companyId: req.user?.companyId
    });
    res.status(500).json({ error: 'Failed to fetch post statistics' });
  }
});

module.exports = router;