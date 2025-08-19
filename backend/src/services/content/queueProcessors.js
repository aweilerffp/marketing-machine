/**
 * Marketing Machine - Content Queue Processors
 * Handles hook generation and post creation jobs
 */

const HookGenerator = require('../ai/hookGenerator');
const { query, transaction } = require('../../config/database');
const logger = require('../../utils/logger').queue;

// Initialize services
const hookGenerator = new HookGenerator();

/**
 * Process hook generation job
 * @param {Object} job - Bull job object
 */
async function processHookGeneration(job) {
  const { contentSourceId, companyId } = job.data;
  
  try {
    logger.info('Processing hook generation job', {
      jobId: job.id,
      contentSourceId,
      companyId
    });

    // Update processing batch status
    await query(
      `UPDATE processing_batches 
       SET status = 'processing', 
           current_step = 1,
           step_details = $1,
           updated_at = NOW()
       WHERE content_source_id = $2`,
      [
        JSON.stringify({ 
          step: 'hook_generation',
          started_at: new Date().toISOString()
        }),
        contentSourceId
      ]
    );

    // Fetch content and company profile
    const contentResult = await query(
      `SELECT title, content, content_type, metadata 
       FROM content_sources 
       WHERE id = $1`,
      [contentSourceId]
    );

    if (contentResult.rows.length === 0) {
      throw new Error(`Content source ${contentSourceId} not found`);
    }

    const content = contentResult.rows[0];

    // Fetch company profile
    const companyResult = await query(
      `SELECT * FROM companies WHERE id = $1`,
      [companyId]
    );

    if (companyResult.rows.length === 0) {
      throw new Error(`Company ${companyId} not found`);
    }

    const companyProfile = companyResult.rows[0];

    // Generate hooks using AI
    const hooks = await hookGenerator.generateHooks(
      content.content,
      companyProfile
    );

    // Store hooks in database
    const storedHooks = await storeGeneratedHooks(
      hooks,
      contentSourceId,
      companyId
    );

    // Update processing batch status
    await query(
      `UPDATE processing_batches 
       SET current_step = 2,
           step_details = $1,
           updated_at = NOW()
       WHERE content_source_id = $2`,
      [
        JSON.stringify({ 
          step: 'hooks_completed',
          hooks_generated: storedHooks.length,
          completed_at: new Date().toISOString()
        }),
        contentSourceId
      ]
    );

    logger.info('Hook generation completed', {
      jobId: job.id,
      contentSourceId,
      companyId,
      hooksGenerated: storedHooks.length
    });

    // Return job result
    return {
      success: true,
      contentSourceId,
      companyId,
      hooksGenerated: storedHooks.length,
      hooks: storedHooks.map(h => ({
        id: h.id,
        text: h.hook_text,
        type: h.hook_type
      }))
    };

  } catch (error) {
    logger.error('Hook generation job failed', {
      jobId: job.id,
      contentSourceId,
      companyId,
      error: error.message,
      stack: error.stack
    });

    // Update processing batch with error
    await query(
      `UPDATE processing_batches 
       SET status = 'failed',
           error_message = $1,
           updated_at = NOW()
       WHERE content_source_id = $2`,
      [error.message, contentSourceId]
    );

    throw error;
  }
}

/**
 * Store generated hooks in database
 * @param {Array} hooks - Hooks to store
 * @param {number} contentSourceId - Content source ID
 * @param {number} companyId - Company ID
 */
async function storeGeneratedHooks(hooks, contentSourceId, companyId) {
  return await transaction(async (client) => {
    const storedHooks = [];

    for (const hook of hooks) {
      try {
        const result = await client.query(
          `INSERT INTO marketing_hooks 
           (content_source_id, company_id, hook_text, hook_type, theme, 
            target_audience, emotional_tone, key_points, metadata, score)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, uuid, hook_text`,
          [
            contentSourceId,
            companyId,
            hook.hook_text,
            hook.hook_type || 'general',
            hook.content_pillar || 'general',
            'LinkedIn professionals',
            hook.target_emotion || 'curiosity',
            JSON.stringify(hook.key_points || []),
            JSON.stringify({
              ...hook.metadata,
              linkedin_hook: hook.linkedin_hook,
              tweet_version: hook.tweet_version,
              blog_title: hook.blog_title,
              source_quote: hook.source_quote,
              source_context: hook.source_context,
              word_count: hook.word_count,
              relevance_score: hook.relevance_score,
              engagement_prediction: hook.engagement_prediction,
              priority: hook.priority
            }),
            hook.priority || 5
          ]
        );

        storedHooks.push({
          id: result.rows[0].id,
          uuid: result.rows[0].uuid,
          hook_text: result.rows[0].hook_text,
          ...hook
        });

      } catch (error) {
        logger.error('Failed to store hook', {
          hook: hook.hook_text,
          error: error.message
        });
      }
    }

    logger.info('Hooks stored in database', {
      contentSourceId,
      companyId,
      totalHooks: hooks.length,
      storedHooks: storedHooks.length
    });

    return storedHooks;
  });
}

/**
 * Process post generation job
 * @param {Object} job - Bull job object
 */
async function processPostGeneration(job) {
  const { hookId, companyId, postType = 'linkedin' } = job.data;
  
  try {
    logger.info('Processing post generation job', {
      jobId: job.id,
      hookId,
      companyId,
      postType
    });

    // Fetch hook details
    const hookResult = await query(
      `SELECT * FROM marketing_hooks WHERE id = $1`,
      [hookId]
    );

    if (hookResult.rows.length === 0) {
      throw new Error(`Hook ${hookId} not found`);
    }

    const hook = hookResult.rows[0];
    const metadata = hook.metadata || {};

    // Create post based on type
    let postContent, postMetadata;

    if (postType === 'linkedin') {
      postContent = metadata.linkedin_hook || hook.hook_text;
      postMetadata = {
        platform: 'linkedin',
        max_length: 3000,
        hashtag_suggestions: generateHashtags(hook),
        emoji_suggestions: generateEmojis(hook)
      };
    } else if (postType === 'twitter') {
      postContent = metadata.tweet_version || hook.hook_text.substring(0, 240);
      postMetadata = {
        platform: 'twitter',
        max_length: 280,
        hashtag_suggestions: generateHashtags(hook, 3)
      };
    } else {
      throw new Error(`Unsupported post type: ${postType}`);
    }

    // Store the generated post
    const postResult = await query(
      `INSERT INTO posts 
       (hook_id, company_id, content, post_type, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, uuid`,
      [
        hookId,
        companyId,
        postContent,
        postType,
        'draft',
        JSON.stringify(postMetadata)
      ]
    );

    const postId = postResult.rows[0].id;

    logger.info('Post generated successfully', {
      jobId: job.id,
      hookId,
      postId,
      postType
    });

    return {
      success: true,
      postId,
      hookId,
      postType,
      content: postContent
    };

  } catch (error) {
    logger.error('Post generation job failed', {
      jobId: job.id,
      hookId,
      companyId,
      postType,
      error: error.message
    });

    throw error;
  }
}

/**
 * Generate relevant hashtags for a hook
 * @param {Object} hook - Hook object
 * @param {number} limit - Maximum number of hashtags
 */
function generateHashtags(hook, limit = 5) {
  const hashtags = [];
  
  // Theme-based hashtags
  const themeHashtags = {
    innovation: ['#Innovation', '#TechInnovation', '#DigitalTransformation'],
    growth: ['#BusinessGrowth', '#GrowthStrategy', '#ScaleUp'],
    efficiency: ['#Efficiency', '#Productivity', '#Automation'],
    leadership: ['#Leadership', '#ThoughtLeadership', '#LeadershipDevelopment'],
    customer: ['#CustomerSuccess', '#CustomerExperience', '#CX'],
    marketing: ['#MarketingStrategy', '#B2BMarketing', '#ContentMarketing'],
    sales: ['#SalesStrategy', '#B2BSales', '#SalesEnablement'],
    technology: ['#Technology', '#TechTrends', '#DigitalStrategy']
  };

  // Get hashtags based on theme
  const theme = hook.theme || 'general';
  if (themeHashtags[theme]) {
    hashtags.push(...themeHashtags[theme]);
  }

  // Hook type based hashtags
  const typeHashtags = {
    pain_point: ['#ProblemSolving', '#BusinessChallenges'],
    success_metric: ['#Results', '#ROI', '#Success'],
    industry_insight: ['#IndustryInsights', '#MarketTrends'],
    thought_leadership: ['#ThoughtLeadership', '#Insights']
  };

  if (typeHashtags[hook.hook_type]) {
    hashtags.push(...typeHashtags[hook.hook_type]);
  }

  // Default hashtags
  hashtags.push('#LinkedIn', '#B2B');

  // Remove duplicates and limit
  return [...new Set(hashtags)].slice(0, limit);
}

/**
 * Generate emoji suggestions for a hook
 * @param {Object} hook - Hook object
 */
function generateEmojis(hook) {
  const emojiMap = {
    curiosity: ['🤔', '💭', '🔍'],
    urgency: ['⚡', '🚨', '⏰'],
    inspiration: ['💡', '🌟', '✨'],
    trust: ['🤝', '✅', '💪'],
    excitement: ['🎉', '🚀', '🔥'],
    concern: ['⚠️', '😟', '📊']
  };

  const emotion = hook.emotional_tone || hook.target_emotion || 'curiosity';
  return emojiMap[emotion] || ['📝', '💼', '📈'];
}

/**
 * Process batch content job
 * @param {Object} job - Bull job object
 */
async function processBatchContent(job) {
  const { companyId, contentSourceIds } = job.data;
  
  try {
    logger.info('Processing batch content job', {
      jobId: job.id,
      companyId,
      contentCount: contentSourceIds.length
    });

    const results = [];

    for (const contentSourceId of contentSourceIds) {
      try {
        // Process each content source
        await processHookGeneration({
          id: `batch-${job.id}-${contentSourceId}`,
          data: { contentSourceId, companyId }
        });

        results.push({
          contentSourceId,
          status: 'success'
        });

      } catch (error) {
        logger.error('Failed to process content in batch', {
          contentSourceId,
          error: error.message
        });

        results.push({
          contentSourceId,
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
    logger.error('Batch content job failed', {
      jobId: job.id,
      companyId,
      error: error.message
    });

    throw error;
  }
}

module.exports = {
  processHookGeneration,
  processPostGeneration,
  processBatchContent
};