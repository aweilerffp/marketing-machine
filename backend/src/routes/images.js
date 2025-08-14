/**
 * Marketing Machine - Image Generation Routes
 * Management of AI-generated images for LinkedIn posts
 */

const express = require('express');
const { query, transaction } = require('../config/database');
const ImageGenerator = require('../services/ai/imageGenerator');
const logger = require('../utils/logger').api;
const { ValidationError } = require('../middleware/errorHandler');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// =============================================
// IMAGE GENERATION ROUTES
// =============================================

/**
 * Generate images for LinkedIn posts
 */
router.post('/generate', [
  body('post_ids').isArray().withMessage('Post IDs must be an array').notEmpty().withMessage('At least one post ID required'),
  body('post_ids.*').isInt().withMessage('Post IDs must be integers'),
  body('model').optional().isIn(['dall-e-3', 'dall-e-2', 'stable-diffusion', 'midjourney']).withMessage('Invalid AI model'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid image generation request', errors.array());
    }

    const { companyId } = req.user;
    const { post_ids, model } = req.body;

    logger.info('Image generation requested', {
      companyId,
      postIds: post_ids,
      model: model || 'default',
      postCount: post_ids.length
    });

    // Get posts with their content
    const postsResult = await query(`
      SELECT 
        lp.id,
        lp.post_content,
        lp.hashtags,
        lp.performance_score,
        mh.hook_text,
        mh.content_pillar
      FROM linkedin_posts lp
      JOIN marketing_hooks mh ON mh.id = lp.marketing_hook_id
      WHERE lp.id = ANY($1) AND lp.company_id = $2
    `, [post_ids, companyId]);

    if (postsResult.rows.length !== post_ids.length) {
      return res.status(403).json({ 
        error: 'Some posts not found or access denied',
        found: postsResult.rows.length,
        requested: post_ids.length
      });
    }

    const posts = postsResult.rows;

    // Get company profile
    const companyResult = await query(`
      SELECT 
        id, name, industry, description, visual_style, settings
      FROM companies
      WHERE id = $1 AND status = 'active'
    `, [companyId]);

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Company profile not found' });
    }

    const companyProfile = {
      ...companyResult.rows[0],
      visual_style: companyResult.rows[0].visual_style || {}
    };

    // Initialize image generator
    const imageGenerator = new ImageGenerator();
    if (model) {
      imageGenerator.defaultModel = model;
    }

    // Generate images
    const generatedImages = await imageGenerator.generateImages(posts, companyProfile);

    // Store images in database
    const storedImages = await imageGenerator.storeImages(generatedImages, posts, companyId);

    logger.info('Images generated successfully', {
      companyId,
      imagesGenerated: storedImages.length,
      model: model || 'default'
    });

    res.json({
      success: true,
      message: `Generated ${storedImages.length} images`,
      images_generated: storedImages.length,
      images: storedImages.map(img => ({
        id: img.id,
        post_id: img.linkedin_post_id,
        model_used: img.model_used,
        image_url: img.image_url,
        quality_score: img.quality_score,
        brand_alignment_score: img.brand_alignment_score,
        status: img.status
      }))
    });

  } catch (error) {
    logger.error('Image generation error', {
      error: error.message,
      companyId: req.user?.companyId,
      postIds: req.body?.post_ids
    });

    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, details: error.details });
    } else {
      res.status(500).json({ error: 'Failed to generate images' });
    }
  }
});

/**
 * Get all images for company
 */
router.get('/', async (req, res) => {
  try {
    const { companyId } = req.user;
    const { 
      status, 
      model,
      limit = 20, 
      offset = 0,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    let whereClause = 'WHERE pi.company_id = $1';
    const params = [companyId];

    if (status) {
      whereClause += ' AND pi.status = $2';
      params.push(status);
    }

    if (model) {
      whereClause += ` AND pi.model_used = $${params.length + 1}`;
      params.push(model);
    }

    const validSorts = ['created_at', 'quality_score', 'brand_alignment_score'];
    const sortBy = validSorts.includes(sort_by) ? sort_by : 'created_at';
    const sortOrder = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const result = await query(`
      SELECT 
        pi.id,
        pi.uuid,
        pi.linkedin_post_id,
        pi.model_used,
        pi.image_url,
        pi.image_size,
        pi.quality_score,
        pi.brand_alignment_score,
        pi.prompt_used,
        pi.status,
        pi.created_at,
        pi.updated_at,
        lp.post_content,
        lp.character_count,
        mh.hook_text
      FROM post_images pi
      JOIN linkedin_posts lp ON lp.id = pi.linkedin_post_id
      JOIN marketing_hooks mh ON mh.id = lp.marketing_hook_id
      ${whereClause}
      ORDER BY pi.${sortBy} ${sortOrder}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM post_images pi
      ${whereClause}
    `, params);

    res.json({
      images: result.rows.map(image => ({
        id: image.id,
        uuid: image.uuid,
        post_id: image.linkedin_post_id,
        model_used: image.model_used,
        image_url: image.image_url,
        image_size: image.image_size,
        quality_score: image.quality_score,
        brand_alignment_score: image.brand_alignment_score,
        prompt_used: image.prompt_used,
        status: image.status,
        post: {
          content: image.post_content?.substring(0, 150) + '...',
          character_count: image.character_count,
          hook_text: image.hook_text
        },
        timestamps: {
          created_at: image.created_at,
          updated_at: image.updated_at
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
    logger.error('Get images error', {
      error: error.message,
      companyId: req.user?.companyId
    });
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

/**
 * Get single image
 */
router.get('/:id', async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    const result = await query(`
      SELECT 
        pi.*,
        lp.post_content,
        lp.hashtags,
        mh.hook_text,
        mh.content_pillar
      FROM post_images pi
      JOIN linkedin_posts lp ON lp.id = pi.linkedin_post_id
      JOIN marketing_hooks mh ON mh.id = lp.marketing_hook_id
      WHERE pi.id = $1 AND pi.company_id = $2
    `, [id, companyId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const image = result.rows[0];

    res.json({
      id: image.id,
      uuid: image.uuid,
      post_id: image.linkedin_post_id,
      model_used: image.model_used,
      image_url: image.image_url,
      image_size: image.image_size,
      quality_score: image.quality_score,
      brand_alignment_score: image.brand_alignment_score,
      prompt_used: image.prompt_used,
      revised_prompt: image.revised_prompt,
      status: image.status,
      post: {
        content: image.post_content,
        hashtags: image.hashtags,
        hook: {
          text: image.hook_text,
          content_pillar: image.content_pillar
        }
      },
      metadata: image.metadata,
      timestamps: {
        created_at: image.created_at,
        updated_at: image.updated_at
      }
    });

  } catch (error) {
    logger.error('Get image error', {
      error: error.message,
      imageId: req.params.id,
      companyId: req.user?.companyId
    });
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

/**
 * Update image status or metadata
 */
router.put('/:id', [
  body('status').optional().isIn(['generated', 'approved', 'rejected', 'archived']).withMessage('Invalid status'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid update data', errors.array());
    }

    const { companyId } = req.user;
    const { id } = req.params;
    const { status } = req.body;

    // Verify image belongs to company
    const imageCheck = await query(`
      SELECT id FROM post_images 
      WHERE id = $1 AND company_id = $2
    `, [id, companyId]);

    if (imageCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const result = await query(`
      UPDATE post_images 
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND company_id = $3
      RETURNING *
    `, [status, id, companyId]);

    logger.info('Image updated', {
      imageId: id,
      companyId,
      status
    });

    res.json({
      success: true,
      message: 'Image updated successfully',
      image: {
        id: result.rows[0].id,
        status: result.rows[0].status,
        updated_at: result.rows[0].updated_at
      }
    });

  } catch (error) {
    logger.error('Update image error', {
      error: error.message,
      imageId: req.params.id,
      companyId: req.user?.companyId
    });

    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, details: error.details });
    } else {
      res.status(500).json({ error: 'Failed to update image' });
    }
  }
});

/**
 * Delete image
 */
router.delete('/:id', async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    // Check if image is in use by approved posts
    const usageCheck = await query(`
      SELECT lp.status 
      FROM post_images pi
      JOIN linkedin_posts lp ON lp.id = pi.linkedin_post_id
      WHERE pi.id = $1 AND pi.company_id = $2
    `, [id, companyId]);

    if (usageCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    if (usageCheck.rows[0].status === 'published') {
      return res.status(400).json({ error: 'Cannot delete image from published post' });
    }

    await query(`
      DELETE FROM post_images 
      WHERE id = $1 AND company_id = $2
    `, [id, companyId]);

    logger.info('Image deleted', { imageId: id, companyId });

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error) {
    logger.error('Delete image error', {
      error: error.message,
      imageId: req.params.id,
      companyId: req.user?.companyId
    });
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

/**
 * Regenerate image with different model or prompt
 */
router.post('/:id/regenerate', [
  body('model').optional().isIn(['dall-e-3', 'dall-e-2', 'stable-diffusion']).withMessage('Invalid AI model'),
  body('custom_prompt').optional().isString().withMessage('Custom prompt must be a string'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid regeneration request', errors.array());
    }

    const { companyId } = req.user;
    const { id } = req.params;
    const { model, custom_prompt } = req.body;

    // Get existing image and post data
    const imageResult = await query(`
      SELECT 
        pi.*,
        lp.post_content,
        lp.hashtags,
        mh.hook_text
      FROM post_images pi
      JOIN linkedin_posts lp ON lp.id = pi.linkedin_post_id
      JOIN marketing_hooks mh ON mh.id = lp.marketing_hook_id
      WHERE pi.id = $1 AND pi.company_id = $2
    `, [id, companyId]);

    if (imageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const existingImage = imageResult.rows[0];

    // Get company profile
    const companyResult = await query(`
      SELECT id, name, industry, visual_style
      FROM companies
      WHERE id = $1
    `, [companyId]);

    const companyProfile = {
      ...companyResult.rows[0],
      visual_style: companyResult.rows[0].visual_style || {}
    };

    // Prepare post data for regeneration
    const post = {
      id: existingImage.linkedin_post_id,
      post_content: existingImage.post_content,
      hashtags: existingImage.hashtags,
      performance_score: 5 // Default value
    };

    // Initialize image generator
    const imageGenerator = new ImageGenerator();
    if (model) {
      imageGenerator.defaultModel = model;
    }

    // Generate new image
    let imagePrompt;
    if (custom_prompt) {
      imagePrompt = custom_prompt;
    } else {
      imagePrompt = await imageGenerator.buildImagePrompt(post, companyProfile);
    }

    const newImageData = await imageGenerator.generateImageWithModel(imagePrompt, companyProfile, model || 'dall-e-3');
    const processedImage = await imageGenerator.processImage(newImageData, post, companyProfile);

    // Update existing image record
    const updatedResult = await query(`
      UPDATE post_images 
      SET 
        model_used = $1,
        image_url = $2,
        image_size = $3,
        quality_score = $4,
        brand_alignment_score = $5,
        prompt_used = $6,
        revised_prompt = $7,
        status = 'generated',
        metadata = $8,
        updated_at = NOW()
      WHERE id = $9 AND company_id = $10
      RETURNING *
    `, [
      processedImage.model,
      processedImage.url,
      processedImage.size,
      processedImage.quality_score,
      processedImage.brand_alignment,
      processedImage.prompt_used,
      processedImage.revised_prompt,
      JSON.stringify(processedImage.metadata),
      id,
      companyId
    ]);

    logger.info('Image regenerated successfully', {
      imageId: id,
      companyId,
      model: processedImage.model
    });

    res.json({
      success: true,
      message: 'Image regenerated successfully',
      image: {
        id: updatedResult.rows[0].id,
        model_used: updatedResult.rows[0].model_used,
        image_url: updatedResult.rows[0].image_url,
        quality_score: updatedResult.rows[0].quality_score,
        brand_alignment_score: updatedResult.rows[0].brand_alignment_score,
        status: updatedResult.rows[0].status
      }
    });

  } catch (error) {
    logger.error('Image regeneration error', {
      error: error.message,
      imageId: req.params.id,
      companyId: req.user?.companyId
    });

    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, details: error.details });
    } else {
      res.status(500).json({ error: 'Failed to regenerate image' });
    }
  }
});

// =============================================
// ANALYTICS AND STATS
// =============================================

/**
 * Get image generation statistics
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const { companyId } = req.user;

    const imageGenerator = new ImageGenerator();
    const stats = await imageGenerator.getStats(companyId);

    // Get model breakdown
    const modelResult = await query(`
      SELECT model_used, COUNT(*) as count
      FROM post_images
      WHERE company_id = $1
      GROUP BY model_used
    `, [companyId]);

    const modelBreakdown = {};
    modelResult.rows.forEach(row => {
      modelBreakdown[row.model_used] = parseInt(row.count);
    });

    // Get recent activity
    const recentResult = await query(`
      SELECT DATE(created_at) as date, COUNT(*) as images_generated
      FROM post_images
      WHERE company_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, [companyId]);

    res.json({
      overview: stats,
      model_breakdown: modelBreakdown,
      recent_activity: recentResult.rows.map(row => ({
        date: row.date,
        images_generated: parseInt(row.images_generated)
      }))
    });

  } catch (error) {
    logger.error('Get image stats error', {
      error: error.message,
      companyId: req.user?.companyId
    });
    res.status(500).json({ error: 'Failed to fetch image statistics' });
  }
});

module.exports = router;