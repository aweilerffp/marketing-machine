/**
 * Marketing Machine - Companies Routes
 */

const express = require('express');
const { query } = require('../config/database');
const { authenticateClerkToken } = require('../middleware/clerk-auth');
const logger = require('../utils/logger');
const router = express.Router();

/**
 * GET /api/companies/current
 * Get current user's company information
 */
router.get('/current', async (req, res, next) => {
  try {
    const { companyId } = req.user;

    if (!companyId) {
      return res.status(404).json({
        error: {
          code: 'COMPANY_NOT_FOUND',
          message: 'User is not associated with a company'
        }
      });
    }

    // Get company details
    const result = await query(
      `SELECT id, uuid, name, website, industry, description, 
              icp, brand_voice, content_pillars, visual_style,
              settings, status, subscription_tier,
              created_at, updated_at
       FROM companies 
       WHERE id = $1`,
      [companyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'COMPANY_NOT_FOUND',
          message: 'Company not found'
        }
      });
    }

    const company = result.rows[0];

    // Also get user count for this company
    const userCountResult = await query(
      `SELECT COUNT(*) as user_count FROM users WHERE company_id = $1 AND status = 'active'`,
      [companyId]
    );

    // Get recent content stats
    const contentStatsResult = await query(
      `SELECT 
         COUNT(*) as total_content,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as recent_content
       FROM content_sources 
       WHERE company_id = $1`,
      [companyId]
    );

    const response = {
      ...company,
      stats: {
        userCount: parseInt(userCountResult.rows[0].user_count),
        totalContent: parseInt(contentStatsResult.rows[0].total_content),
        recentContent: parseInt(contentStatsResult.rows[0].recent_content)
      }
    };

    logger.debug('Company information retrieved', {
      userId: req.user.id,
      companyId: company.id,
      companyName: company.name
    });

    res.json(response);
  } catch (error) {
    logger.error('Failed to get company information', {
      userId: req.user?.id,
      companyId: req.user?.companyId,
      error: error.message
    });
    next(error);
  }
});

/**
 * PUT /api/companies/current
 * Update current user's company information
 */
router.put('/current', async (req, res, next) => {
  try {
    const { companyId, role } = req.user;
    const { 
      name, 
      website, 
      industry, 
      description, 
      icp, 
      brand_voice, 
      content_pillars, 
      visual_style,
      settings 
    } = req.body;

    if (!companyId) {
      return res.status(404).json({
        error: {
          code: 'COMPANY_NOT_FOUND',
          message: 'User is not associated with a company'
        }
      });
    }

    // Check if user has permission to update company
    if (role !== 'admin' && role !== 'manager') {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Only admins and managers can update company information'
        }
      });
    }

    // Build update query dynamically based on provided fields
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (website !== undefined) {
      updateFields.push(`website = $${paramCount++}`);
      values.push(website);
    }
    if (industry !== undefined) {
      updateFields.push(`industry = $${paramCount++}`);
      values.push(industry);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (icp !== undefined) {
      updateFields.push(`icp = $${paramCount++}`);
      values.push(JSON.stringify(icp));
    }
    if (brand_voice !== undefined) {
      updateFields.push(`brand_voice = $${paramCount++}`);
      values.push(JSON.stringify(brand_voice));
    }
    if (content_pillars !== undefined) {
      updateFields.push(`content_pillars = $${paramCount++}`);
      values.push(JSON.stringify(content_pillars));
    }
    if (visual_style !== undefined) {
      updateFields.push(`visual_style = $${paramCount++}`);
      values.push(JSON.stringify(visual_style));
    }
    if (settings !== undefined) {
      updateFields.push(`settings = $${paramCount++}`);
      values.push(JSON.stringify(settings));
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: {
          code: 'NO_FIELDS_TO_UPDATE',
          message: 'No valid fields provided for update'
        }
      });
    }

    // Add updated_at and company_id to the query
    updateFields.push(`updated_at = NOW()`);
    values.push(companyId);

    const updateQuery = `
      UPDATE companies 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, uuid, name, website, industry, description, 
                icp, brand_voice, content_pillars, visual_style,
                settings, status, subscription_tier,
                created_at, updated_at
    `;

    const result = await query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: {
          code: 'COMPANY_NOT_FOUND',
          message: 'Company not found'
        }
      });
    }

    logger.info('Company information updated', {
      userId: req.user.id,
      companyId: result.rows[0].id,
      updatedFields: Object.keys(req.body)
    });

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('Failed to update company information', {
      userId: req.user?.id,
      companyId: req.user?.companyId,
      error: error.message
    });
    next(error);
  }
});

/**
 * GET /api/companies/stats
 * Get company usage statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const { companyId } = req.user;

    if (!companyId) {
      return res.status(404).json({
        error: {
          code: 'COMPANY_NOT_FOUND',
          message: 'User is not associated with a company'
        }
      });
    }

    // Get comprehensive stats
    const statsResult = await query(`
      SELECT 
        -- Content stats
        (SELECT COUNT(*) FROM content_sources WHERE company_id = $1) as total_content,
        (SELECT COUNT(*) FROM content_sources WHERE company_id = $1 AND created_at > NOW() - INTERVAL '30 days') as content_this_month,
        
        -- Processing stats
        (SELECT COUNT(*) FROM processing_batches WHERE company_id = $1) as total_batches,
        (SELECT COUNT(*) FROM processing_batches WHERE company_id = $1 AND status = 'completed') as completed_batches,
        
        -- Posts stats
        (SELECT COUNT(*) FROM linkedin_posts WHERE company_id = $1) as total_posts,
        (SELECT COUNT(*) FROM linkedin_posts WHERE company_id = $1 AND status = 'published') as published_posts,
        (SELECT COUNT(*) FROM linkedin_posts WHERE company_id = $1 AND created_at > NOW() - INTERVAL '30 days') as posts_this_month,
        
        -- User stats
        (SELECT COUNT(*) FROM users WHERE company_id = $1 AND status = 'active') as active_users
    `, [companyId]);

    const stats = statsResult.rows[0];

    // Convert string counts to numbers
    Object.keys(stats).forEach(key => {
      stats[key] = parseInt(stats[key]) || 0;
    });

    res.json(stats);
  } catch (error) {
    logger.error('Failed to get company stats', {
      userId: req.user?.id,
      companyId: req.user?.companyId,
      error: error.message
    });
    next(error);
  }
});

module.exports = router;