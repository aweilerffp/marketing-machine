/**
 * Marketing Machine - Webhook Routes
 * Configuration and management of webhook endpoints
 */

const express = require('express');
const { query, transaction } = require('../config/database');
const logger = require('../utils/logger').webhook;
const { ValidationError } = require('../middleware/errorHandler');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// =============================================
// WEBHOOK CONFIGURATION ROUTES
// =============================================

/**
 * Get all webhook configurations for a company
 */
router.get('/configs', async (req, res) => {
  try {
    const { companyId } = req.user;

    const result = await query(`
      SELECT 
        wc.id,
        wc.uuid,
        wc.name,
        wc.webhook_url,
        wc.source_type,
        wc.status,
        wc.last_received_at,
        wc.total_received,
        wc.created_at,
        wc.updated_at,
        wc.secret_key,
        wc.filters,
        wc.payload_mapping,
        COUNT(DISTINCT cs.id) as transcripts_processed,
        COUNT(DISTINCT mh.id) as hooks_generated,
        MAX(cs.created_at) as last_transcript_at
      FROM webhook_configs wc
      LEFT JOIN content_sources cs ON cs.source_name = wc.source_type 
        AND cs.company_id = wc.company_id
      LEFT JOIN marketing_hooks mh ON mh.content_source_id = cs.id
      WHERE wc.company_id = $1
      GROUP BY wc.id
      ORDER BY wc.created_at DESC
    `, [companyId]);

    // Add statistics and setup instructions for each webhook
    const webhooksWithStats = result.rows.map(webhook => ({
      ...webhook,
      statistics: {
        total_received: parseInt(webhook.total_received || 0),
        transcripts_processed: parseInt(webhook.transcripts_processed || 0),
        hooks_generated: parseInt(webhook.hooks_generated || 0),
        last_received: webhook.last_transcript_at || webhook.last_received_at,
        success_rate: webhook.total_received > 0 
          ? ((webhook.transcripts_processed / webhook.total_received) * 100).toFixed(1)
          : 0
      },
      setup_instructions: getWebhookInstructions(webhook.source_type, webhook.webhook_url, webhook.secret_key)
    }));

    res.json({
      webhooks: webhooksWithStats,
      total: result.rows.length
    });

  } catch (error) {
    logger.error('Get webhook configs error', { 
      error: error.message, 
      companyId: req.user.companyId 
    });
    res.status(500).json({ error: 'Failed to fetch webhook configurations' });
  }
});

/**
 * Create new webhook configuration
 */
router.post('/configs', [
  body('name').notEmpty().withMessage('Webhook name is required'),
  body('source_type').isIn(['read.ai', 'otter.ai', 'zoom', 'custom']).withMessage('Invalid source type'),
  body('payload_mapping').optional().isObject().withMessage('Payload mapping must be an object'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid webhook configuration', errors.array());
    }

    const { companyId } = req.user;
    const { 
      name, 
      source_type, 
      payload_mapping = {}, 
      filters = {},
      description = ''
    } = req.body;

    // Generate unique webhook URL with ID
    const webhookId = require('crypto').randomBytes(8).toString('hex');
    const webhookUrl = `${process.env.WEBHOOK_URL || 'http://localhost:3002'}/webhook/${source_type === 'custom' ? 'meeting-recorder' : source_type.replace('.', '-')}/${webhookId}`;

    // Generate secret key for signature verification
    const secretKey = require('crypto').randomBytes(32).toString('hex');

    const result = await query(`
      INSERT INTO webhook_configs 
      (company_id, name, webhook_url, source_type, secret_key, payload_mapping, filters)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, uuid, webhook_url, secret_key
    `, [
      companyId,
      name,
      webhookUrl,
      source_type,
      secretKey,
      JSON.stringify(payload_mapping),
      JSON.stringify(filters)
    ]);

    const webhookConfig = result.rows[0];

    logger.info('Webhook configuration created', {
      webhookId: webhookConfig.id,
      companyId,
      sourceType: source_type,
      name
    });

    res.status(201).json({
      success: true,
      webhook: {
        id: webhookConfig.id,
        uuid: webhookConfig.uuid,
        name,
        source_type,
        webhook_url: webhookConfig.webhook_url,
        secret_key: webhookConfig.secret_key,
        instructions: getWebhookInstructions(source_type, webhookConfig.webhook_url, webhookConfig.secret_key)
      }
    });

  } catch (error) {
    logger.error('Create webhook config error', {
      error: error.message,
      companyId: req.user.companyId,
      body: req.body
    });

    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, details: error.details });
    } else {
      res.status(500).json({ error: 'Failed to create webhook configuration' });
    }
  }
});

/**
 * Update webhook configuration
 */
router.put('/configs/:id', [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('status').optional().isIn(['active', 'paused', 'disabled']).withMessage('Invalid status'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid update data', errors.array());
    }

    const { companyId } = req.user;
    const { id } = req.params;
    const updates = req.body;

    // Build update query dynamically
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (['name', 'status', 'payload_mapping', 'filters'].includes(key)) {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(typeof value === 'object' ? JSON.stringify(value) : value);
        paramCount++;
      }
    });

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateFields.push(`updated_at = NOW()`);
    values.push(companyId, id);

    const result = await query(`
      UPDATE webhook_configs 
      SET ${updateFields.join(', ')}
      WHERE company_id = $${paramCount} AND id = $${paramCount + 1}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook configuration not found' });
    }

    logger.info('Webhook configuration updated', {
      webhookId: id,
      companyId,
      updates: Object.keys(updates)
    });

    res.json({
      success: true,
      webhook: result.rows[0]
    });

  } catch (error) {
    logger.error('Update webhook config error', {
      error: error.message,
      webhookId: req.params.id,
      companyId: req.user.companyId
    });

    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, details: error.details });
    } else {
      res.status(500).json({ error: 'Failed to update webhook configuration' });
    }
  }
});

/**
 * Delete webhook configuration
 */
router.delete('/configs/:id', async (req, res) => {
  try {
    const { companyId } = req.user;
    const { id } = req.params;

    const result = await query(`
      DELETE FROM webhook_configs 
      WHERE company_id = $1 AND id = $2
      RETURNING name
    `, [companyId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook configuration not found' });
    }

    logger.info('Webhook configuration deleted', {
      webhookId: id,
      companyId,
      name: result.rows[0].name
    });

    res.json({
      success: true,
      message: 'Webhook configuration deleted successfully'
    });

  } catch (error) {
    logger.error('Delete webhook config error', {
      error: error.message,
      webhookId: req.params.id,
      companyId: req.user.companyId
    });
    res.status(500).json({ error: 'Failed to delete webhook configuration' });
  }
});

// =============================================
// WEBHOOK TESTING AND MONITORING
// =============================================

/**
 * Test webhook configuration
 */
router.post('/test/:configId', async (req, res) => {
  try {
    const { companyId } = req.user;
    const { configId } = req.params;

    // Get webhook config
    const configResult = await query(`
      SELECT * FROM webhook_configs 
      WHERE company_id = $1 AND id = $2
    `, [companyId, configId]);

    if (configResult.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook configuration not found' });
    }

    const config = configResult.rows[0];

    // Send test payload to webhook endpoint
    const testPayload = {
      test: true,
      content: 'This is a test webhook from Marketing Machine.',
      timestamp: new Date().toISOString(),
      source: config.source_type
    };

    const axios = require('axios');
    
    try {
      const response = await axios.post(`${config.webhook_url}/test`, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Source': config.source_type
        },
        timeout: 10000
      });

      logger.info('Webhook test successful', {
        webhookId: configId,
        companyId,
        responseStatus: response.status
      });

      res.json({
        success: true,
        message: 'Webhook test completed successfully',
        response: {
          status: response.status,
          data: response.data
        }
      });

    } catch (error) {
      logger.warn('Webhook test failed', {
        webhookId: configId,
        companyId,
        error: error.message
      });

      res.status(400).json({
        success: false,
        error: 'Webhook test failed',
        details: error.response?.data || error.message
      });
    }

  } catch (error) {
    logger.error('Webhook test error', {
      error: error.message,
      configId: req.params.configId,
      companyId: req.user.companyId
    });
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

/**
 * Get webhook delivery history
 */
router.get('/deliveries/:configId', async (req, res) => {
  try {
    const { companyId } = req.user;
    const { configId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verify webhook belongs to company
    const configCheck = await query(`
      SELECT id FROM webhook_configs 
      WHERE company_id = $1 AND id = $2
    `, [companyId, configId]);

    if (configCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook configuration not found' });
    }

    // Get delivery history
    const result = await query(`
      SELECT 
        wd.id,
        wd.status,
        wd.received_at,
        wd.processed_at,
        wd.error_message,
        cs.title as content_title,
        cs.content_type
      FROM webhook_deliveries wd
      LEFT JOIN content_sources cs ON wd.content_source_id = cs.id
      WHERE wd.webhook_config_id = $1
      ORDER BY wd.received_at DESC
      LIMIT $2 OFFSET $3
    `, [configId, limit, offset]);

    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM webhook_deliveries
      WHERE webhook_config_id = $1
    `, [configId]);

    res.json({
      deliveries: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    logger.error('Get webhook deliveries error', {
      error: error.message,
      configId: req.params.configId,
      companyId: req.user.companyId
    });
    res.status(500).json({ error: 'Failed to fetch webhook deliveries' });
  }
});

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Get setup instructions for different webhook sources
 * @param {string} sourceType - Type of webhook source
 * @param {string} webhookUrl - Generated webhook URL
 * @param {string} secretKey - Secret key for verification
 * @returns {Object} Setup instructions
 */
function getWebhookInstructions(sourceType, webhookUrl, secretKey) {
  const instructions = {
    'read.ai': {
      title: 'Read.ai Webhook Setup',
      steps: [
        'Go to your Read.ai settings',
        'Navigate to Integrations → Webhooks',
        'Add new webhook endpoint',
        `Set URL to: ${webhookUrl}`,
        'Select "Meeting Completed" event',
        `Set secret to: ${secretKey}`,
        'Save configuration'
      ],
      payload_format: {
        meeting_id: 'string',
        title: 'string',
        transcript: 'string',
        date: 'ISO date',
        participants: 'array',
        duration: 'number (minutes)'
      }
    },
    'otter.ai': {
      title: 'Otter.ai Webhook Setup',
      steps: [
        'Access your Otter.ai developer console',
        'Create new webhook integration',
        `Set endpoint URL to: ${webhookUrl}`,
        'Subscribe to "transcript.completed" events',
        `Configure HMAC secret: ${secretKey}`,
        'Test the integration'
      ],
      payload_format: {
        id: 'string',
        title: 'string',
        transcript_text: 'string',
        created_at: 'ISO date',
        summary: 'string',
        speakers: 'array'
      }
    },
    'zoom': {
      title: 'Zoom Webhook Setup',
      steps: [
        'Go to Zoom App Marketplace',
        'Create a Webhook-only app',
        'Add webhook endpoint subscription',
        `Set endpoint URL to: ${webhookUrl}`,
        'Subscribe to "recording.completed" event',
        `Set secret token: ${secretKey}`,
        'Activate the app'
      ],
      payload_format: {
        event: 'recording.completed',
        payload: {
          object: {
            id: 'meeting_id',
            topic: 'meeting_title',
            start_time: 'ISO date',
            recording_files: 'array'
          }
        }
      }
    },
    'custom': {
      title: 'Custom Webhook Integration',
      steps: [
        'Configure your system to send POST requests',
        `Send requests to: ${webhookUrl}`,
        'Include content in request body',
        `Optional: Sign requests with secret: ${secretKey}`,
        'Include "X-Webhook-Source" header with your system name'
      ],
      payload_format: {
        title: 'string (optional)',
        content: 'string (required - main content/transcript)',
        transcript: 'string (alternative to content)',
        metadata: 'object (optional additional data)'
      }
    }
  };

  return instructions[sourceType] || instructions.custom;
}

module.exports = router;