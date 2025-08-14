/**
 * Marketing Machine - Content Processor
 * Orchestrates the content processing pipeline
 */

const { query, transaction } = require('../../config/database');
const HookGenerator = require('./hookGenerator');
const logger = require('../../utils/logger').ai;

/**
 * Content Processing Service
 */
class ContentProcessor {
  constructor() {
    this.hookGenerator = new HookGenerator();
  }

  /**
   * Generate hooks from content source
   * @param {number} contentSourceId - Content source ID
   * @param {number} companyId - Company ID
   * @returns {Promise<Object>} Processing result
   */
  async generateHooks(contentSourceId, companyId) {
    try {
      logger.info('Starting hook generation process', { contentSourceId, companyId });

      // Get content and company profile
      const [content, companyProfile] = await Promise.all([
        this.getContentSource(contentSourceId),
        this.getCompanyProfile(companyId)
      ]);

      if (!content) {
        throw new Error('Content source not found');
      }

      if (!companyProfile) {
        throw new Error('Company profile not found');
      }

      // Update processing status
      await this.updateProcessingStatus(content.processing_batch_id, 'processing', 1, {
        current_step: 'generating_hooks',
        progress: 10
      });

      // Generate hooks using AI
      const hooks = await this.hookGenerator.generateHooks(content.content, companyProfile);

      // Store hooks in database
      const storedHooks = await this.storeHooks(hooks, contentSourceId, companyId, content.processing_batch_id);

      // Update processing status
      await this.updateProcessingStatus(content.processing_batch_id, 'processing', 2, {
        current_step: 'hooks_generated',
        progress: 50,
        hooks_generated: storedHooks.length
      });

      logger.info('Hook generation completed', {
        contentSourceId,
        companyId,
        hooksGenerated: storedHooks.length,
        processingBatchId: content.processing_batch_id
      });

      return {
        success: true,
        contentSourceId,
        processingBatchId: content.processing_batch_id,
        hooksGenerated: storedHooks.length,
        hooks: storedHooks.map(h => ({
          id: h.id,
          hook_text: h.hook_text,
          hook_type: h.hook_type,
          relevance_score: h.relevance_score,
          engagement_prediction: h.engagement_prediction
        }))
      };

    } catch (error) {
      logger.error('Hook generation failed', {
        error: error.message,
        stack: error.stack,
        contentSourceId,
        companyId
      });

      // Update processing status to failed
      if (contentSourceId) {
        try {
          const content = await this.getContentSource(contentSourceId);
          if (content?.processing_batch_id) {
            await this.updateProcessingStatus(content.processing_batch_id, 'failed', null, {
              error: error.message,
              failed_step: 'hook_generation'
            });
          }
        } catch (updateError) {
          logger.error('Failed to update processing status', { error: updateError.message });
        }
      }

      throw error;
    }
  }

  /**
   * Generate LinkedIn posts from hooks
   * @param {Array} hookIds - Array of hook IDs
   * @param {number} companyId - Company ID
   * @returns {Promise<Object>} Processing result
   */
  async generatePosts(hookIds, companyId) {
    try {
      logger.info('Starting post generation process', { hookIds, companyId });

      // This will be implemented in the next step (LinkedIn post generation)
      // For now, return placeholder response
      return {
        success: true,
        message: 'Post generation will be implemented in next phase',
        hookIds,
        companyId
      };

    } catch (error) {
      logger.error('Post generation failed', {
        error: error.message,
        hookIds,
        companyId
      });
      throw error;
    }
  }

  /**
   * Get content source by ID
   * @param {number} contentSourceId - Content source ID
   * @returns {Promise<Object>} Content source data
   */
  async getContentSource(contentSourceId) {
    try {
      const result = await query(`
        SELECT 
          cs.*,
          pb.id as processing_batch_id,
          pb.status as processing_status
        FROM content_sources cs
        LEFT JOIN processing_batches pb ON pb.content_source_id = cs.id
        WHERE cs.id = $1
      `, [contentSourceId]);

      return result.rows[0] || null;

    } catch (error) {
      logger.error('Error getting content source', {
        error: error.message,
        contentSourceId
      });
      throw error;
    }
  }

  /**
   * Get company profile with brand voice and content pillars
   * @param {number} companyId - Company ID
   * @returns {Promise<Object>} Company profile
   */
  async getCompanyProfile(companyId) {
    try {
      const result = await query(`
        SELECT 
          id,
          name,
          industry,
          description,
          icp,
          brand_voice,
          content_pillars,
          visual_style,
          settings
        FROM companies
        WHERE id = $1 AND status = 'active'
      `, [companyId]);

      const company = result.rows[0];
      if (!company) {
        return null;
      }

      // Ensure default values for missing fields
      return {
        ...company,
        icp: company.icp || {},
        brand_voice: company.brand_voice || {
          tone: ['professional', 'helpful'],
          keywords: [],
          prohibited_terms: []
        },
        content_pillars: company.content_pillars || [],
        visual_style: company.visual_style || {},
        settings: company.settings || {}
      };

    } catch (error) {
      logger.error('Error getting company profile', {
        error: error.message,
        companyId
      });
      throw error;
    }
  }

  /**
   * Store generated hooks in database
   * @param {Array} hooks - Generated hooks
   * @param {number} contentSourceId - Content source ID
   * @param {number} companyId - Company ID
   * @param {number} processingBatchId - Processing batch ID
   * @returns {Promise<Array>} Stored hooks with IDs
   */
  async storeHooks(hooks, contentSourceId, companyId, processingBatchId) {
    try {
      const storedHooks = [];

      await transaction(async (client) => {
        for (const [index, hook] of hooks.entries()) {
          const result = await client.query(`
            INSERT INTO marketing_hooks (
              processing_batch_id,
              company_id,
              hook_text,
              hook_type,
              content_pillar,
              source_quote,
              source_context,
              linkedin_hook,
              tweet_version,
              blog_title,
              relevance_score,
              engagement_potential,
              priority,
              status,
              metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'ready', $14)
            RETURNING *
          `, [
            processingBatchId,
            companyId,
            hook.hook_text,
            hook.hook_type,
            hook.content_pillar,
            hook.source_quote,
            hook.source_context,
            hook.linkedin_hook,
            hook.tweet_version,
            hook.blog_title,
            hook.relevance_score,
            hook.engagement_prediction,
            hook.priority,
            JSON.stringify(hook.metadata)
          ]);

          storedHooks.push(result.rows[0]);
        }
      });

      logger.info('Hooks stored successfully', {
        count: storedHooks.length,
        contentSourceId,
        processingBatchId
      });

      return storedHooks;

    } catch (error) {
      logger.error('Error storing hooks', {
        error: error.message,
        hooksCount: hooks.length,
        contentSourceId,
        processingBatchId
      });
      throw error;
    }
  }

  /**
   * Update processing batch status
   * @param {number} batchId - Processing batch ID
   * @param {string} status - New status
   * @param {number} currentStep - Current step number
   * @param {Object} stepDetails - Additional step details
   */
  async updateProcessingStatus(batchId, status, currentStep = null, stepDetails = {}) {
    try {
      const updates = {
        status,
        step_details: JSON.stringify(stepDetails)
      };

      if (currentStep !== null) {
        updates.current_step = currentStep;
      }

      if (status === 'completed') {
        updates.completed_at = 'NOW()';
      }

      // Build dynamic query
      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');

      const values = [batchId, ...Object.values(updates)];

      await query(`
        UPDATE processing_batches 
        SET ${setClause}
        WHERE id = $1
      `, values);

      logger.debug('Processing status updated', {
        batchId,
        status,
        currentStep,
        stepDetails
      });

    } catch (error) {
      logger.error('Error updating processing status', {
        error: error.message,
        batchId,
        status
      });
      // Don't throw - this is a non-critical update
    }
  }

  /**
   * Get processing status
   * @param {number} batchId - Processing batch ID
   * @returns {Promise<Object>} Processing status
   */
  async getProcessingStatus(batchId) {
    try {
      const result = await query(`
        SELECT 
          pb.*,
          cs.title as content_title,
          cs.content_type,
          COUNT(mh.id) as hooks_generated
        FROM processing_batches pb
        JOIN content_sources cs ON cs.id = pb.content_source_id
        LEFT JOIN marketing_hooks mh ON mh.processing_batch_id = pb.id
        WHERE pb.id = $1
        GROUP BY pb.id, cs.id
      `, [batchId]);

      if (result.rows.length === 0) {
        return null;
      }

      const batch = result.rows[0];
      
      return {
        id: batch.id,
        uuid: batch.uuid,
        status: batch.status,
        current_step: batch.current_step,
        total_steps: batch.total_steps,
        step_details: batch.step_details ? JSON.parse(batch.step_details) : {},
        content_title: batch.content_title,
        content_type: batch.content_type,
        hooks_generated: parseInt(batch.hooks_generated),
        started_at: batch.started_at,
        completed_at: batch.completed_at,
        estimated_completion: batch.estimated_completion
      };

    } catch (error) {
      logger.error('Error getting processing status', {
        error: error.message,
        batchId
      });
      throw error;
    }
  }

  /**
   * Get company's processing history
   * @param {number} companyId - Company ID
   * @param {number} limit - Number of batches to return
   * @returns {Promise<Array>} Processing batches
   */
  async getProcessingHistory(companyId, limit = 20) {
    try {
      const result = await query(`
        SELECT 
          pb.*,
          cs.title as content_title,
          cs.source_name,
          cs.content_type,
          COUNT(mh.id) as hooks_generated
        FROM processing_batches pb
        JOIN content_sources cs ON cs.id = pb.content_source_id
        LEFT JOIN marketing_hooks mh ON mh.processing_batch_id = pb.id
        WHERE pb.company_id = $1
        GROUP BY pb.id, cs.id
        ORDER BY pb.created_at DESC
        LIMIT $2
      `, [companyId, limit]);

      return result.rows.map(batch => ({
        id: batch.id,
        uuid: batch.uuid,
        status: batch.status,
        content_title: batch.content_title,
        content_type: batch.content_type,
        source_name: batch.source_name,
        hooks_generated: parseInt(batch.hooks_generated),
        created_at: batch.created_at,
        completed_at: batch.completed_at
      }));

    } catch (error) {
      logger.error('Error getting processing history', {
        error: error.message,
        companyId
      });
      throw error;
    }
  }

  /**
   * Get hooks for a processing batch
   * @param {number} batchId - Processing batch ID
   * @returns {Promise<Array>} Hooks
   */
  async getHooksForBatch(batchId) {
    try {
      const result = await query(`
        SELECT *
        FROM marketing_hooks
        WHERE processing_batch_id = $1
        ORDER BY priority DESC, relevance_score DESC
      `, [batchId]);

      return result.rows.map(hook => ({
        id: hook.id,
        uuid: hook.uuid,
        hook_text: hook.hook_text,
        hook_type: hook.hook_type,
        content_pillar: hook.content_pillar,
        source_quote: hook.source_quote,
        linkedin_hook: hook.linkedin_hook,
        tweet_version: hook.tweet_version,
        blog_title: hook.blog_title,
        relevance_score: hook.relevance_score,
        engagement_potential: hook.engagement_potential,
        priority: hook.priority,
        status: hook.status,
        created_at: hook.created_at
      }));

    } catch (error) {
      logger.error('Error getting hooks for batch', {
        error: error.message,
        batchId
      });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = {
  processContent: new ContentProcessor()
};