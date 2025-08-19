/**
 * Marketing Machine - Image Queue Processor
 * Handles image generation jobs for posts
 */

const ImageGenerator = require('./imageGenerator');
const { query } = require('../../config/database');
const logger = require('../../utils/logger').queue;

// Initialize image generator
const imageGenerator = new ImageGenerator();

/**
 * Process image generation job
 * @param {Object} job - Bull job object
 */
async function processImageGeneration(job) {
  const { postId, hookId, companyId } = job.data;
  
  try {
    logger.info('Processing image generation job', {
      jobId: job.id,
      postId,
      hookId,
      companyId
    });

    // Fetch post details
    const postResult = await query(
      `SELECT p.*, h.hook_text, h.theme, h.hook_type, h.metadata as hook_metadata
       FROM posts p
       LEFT JOIN marketing_hooks h ON p.hook_id = h.id
       WHERE p.id = $1`,
      [postId]
    );

    if (postResult.rows.length === 0) {
      throw new Error(`Post ${postId} not found`);
    }

    const post = postResult.rows[0];

    // Fetch company profile
    const companyResult = await query(
      `SELECT * FROM companies WHERE id = $1`,
      [companyId]
    );

    if (companyResult.rows.length === 0) {
      throw new Error(`Company ${companyId} not found`);
    }

    const company = companyResult.rows[0];

    // Prepare post data for image generation
    const postData = {
      id: post.id,
      post_content: post.content,
      hashtags: post.metadata?.hashtags || [],
      hook_text: post.hook_text,
      theme: post.theme,
      hook_type: post.hook_type
    };

    // Generate image using AI
    const images = await imageGenerator.generateImages([postData], company);

    if (images.length === 0) {
      throw new Error('No images generated');
    }

    const generatedImage = images[0];

    // Store image in database
    const imageResult = await query(
      `INSERT INTO generated_images 
       (hook_id, company_id, post_id, filename, file_paths, prompt, metadata, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, uuid`,
      [
        hookId,
        companyId,
        postId,
        `post_${postId}_${Date.now()}`,
        JSON.stringify({
          url: generatedImage.url,
          size: generatedImage.size,
          model: generatedImage.model
        }),
        generatedImage.prompt_used,
        JSON.stringify({
          ...generatedImage.metadata,
          quality_score: generatedImage.quality_score,
          brand_alignment: generatedImage.brand_alignment,
          performance_metrics: generatedImage.performance_metrics
        }),
        'completed'
      ]
    );

    const imageId = imageResult.rows[0].id;

    // Update post with image reference
    await query(
      `UPDATE posts 
       SET metadata = jsonb_set(
         COALESCE(metadata, '{}')::jsonb,
         '{image_id}',
         $1::jsonb
       ),
       updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(imageId), postId]
    );

    logger.info('Image generation completed', {
      jobId: job.id,
      postId,
      imageId,
      model: generatedImage.model
    });

    return {
      success: true,
      postId,
      imageId,
      imageUrl: generatedImage.url,
      model: generatedImage.model,
      qualityScore: generatedImage.quality_score
    };

  } catch (error) {
    logger.error('Image generation job failed', {
      jobId: job.id,
      postId,
      companyId,
      error: error.message,
      stack: error.stack
    });

    // Update post status to indicate image generation failed
    await query(
      `UPDATE posts 
       SET metadata = jsonb_set(
         COALESCE(metadata, '{}')::jsonb,
         '{image_generation_failed}',
         'true'::jsonb
       ),
       updated_at = NOW()
       WHERE id = $1`,
      [postId]
    );

    throw error;
  }
}

/**
 * Process batch image generation
 * @param {Object} job - Bull job object
 */
async function processBatchImageGeneration(job) {
  const { postIds, companyId } = job.data;
  
  try {
    logger.info('Processing batch image generation', {
      jobId: job.id,
      postCount: postIds.length,
      companyId
    });

    const results = [];

    for (const postId of postIds) {
      try {
        const result = await processImageGeneration({
          id: `batch-${job.id}-${postId}`,
          data: { postId, companyId }
        });

        results.push({
          postId,
          status: 'success',
          imageId: result.imageId
        });

      } catch (error) {
        logger.error('Failed to generate image for post in batch', {
          postId,
          error: error.message
        });

        results.push({
          postId,
          status: 'failed',
          error: error.message
        });
      }
    }

    return {
      success: true,
      companyId,
      totalProcessed: results.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      results
    };

  } catch (error) {
    logger.error('Batch image generation failed', {
      jobId: job.id,
      companyId,
      error: error.message
    });

    throw error;
  }
}

module.exports = {
  processImageGeneration,
  processBatchImageGeneration
};