/**
 * Marketing Machine - Webhook Server
 * Dedicated server for receiving webhooks from meeting recorders
 */

const express = require('express');
const { query, transaction } = require('../../config/database');
const { addContentJob } = require('../../config/queue');
const logger = require('../../utils/logger').webhook;
const crypto = require('crypto');

/**
 * Start webhook server on separate port
 * @param {number} port - Port to start webhook server on
 */
function startWebhookServer(port = 3002) {
  const app = express();

  // Middleware for webhook server
  app.use(express.json({ limit: '50mb' }));
  app.use(express.raw({ type: 'application/json', limit: '50mb' }));

  // Health check for webhook server
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'Marketing Machine Webhook Server',
      timestamp: new Date().toISOString(),
      port
    });
  });

  // =============================================
  // GENERIC WEBHOOK ENDPOINT
  // =============================================

  /**
   * Generic webhook endpoint that adapts to different meeting recorders
   */
  app.post('/webhook/meeting-recorder', async (req, res) => {
    try {
      const source = req.headers['x-webhook-source'] || 'unknown';
      const signature = req.headers['x-webhook-signature'] || req.headers['signature'];
      
      logger.info('Webhook received', {
        source,
        contentLength: JSON.stringify(req.body).length,
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });

      // Verify webhook signature if provided
      if (signature && process.env.WEBHOOK_SECRET) {
        const isValid = verifyWebhookSignature(req.body, signature, process.env.WEBHOOK_SECRET);
        if (!isValid) {
          logger.warn('Invalid webhook signature', { source, signature });
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      // Process webhook payload
      const processedContent = await processWebhookPayload(req.body, source, req.headers);

      if (!processedContent) {
        logger.warn('No content extracted from webhook', { source, payload: req.body });
        return res.status(400).json({ error: 'No content found in webhook payload' });
      }

      // Store in database and trigger processing
      const result = await storeWebhookContent(processedContent);

      // Trigger Marketing Machine processing
      try {
        await addContentJob('generate-hooks', {
          contentSourceId: result.contentSourceId,
          companyId: processedContent.companyId
        });
        logger.info('Content job queued successfully');
      } catch (queueError) {
        logger.warn('Failed to queue content job, but webhook data was stored', {
          error: queueError.message,
          contentSourceId: result.contentSourceId
        });
        // Don't fail the webhook if queue fails
      }

      logger.info('Webhook processed successfully', {
        source,
        contentSourceId: result.contentSourceId,
        title: processedContent.title
      });

      res.json({
        success: true,
        message: 'Marketing Machine is processing your content',
        contentSourceId: result.contentSourceId,
        processingBatchId: result.processingBatchId
      });

    } catch (error) {
      logger.error('Webhook processing error', {
        error: error.message,
        stack: error.stack,
        source: req.headers['x-webhook-source'],
        payload: req.body
      });

      res.status(500).json({
        error: 'Webhook processing failed',
        message: error.message
      });
    }
  });

  // =============================================
  // SPECIFIC WEBHOOK ENDPOINTS
  // =============================================

  /**
   * Read.ai webhook endpoint
   */
  app.post('/webhook/read-ai', async (req, res) => {
    try {
      const { meeting_id, transcript, title, date, participants, duration } = req.body;

      if (!transcript) {
        return res.status(400).json({ error: 'No transcript provided' });
      }

      const content = {
        title: title || `Read.ai Meeting - ${new Date().toLocaleDateString()}`,
        content: transcript,
        contentType: 'meeting_transcript',
        source: 'read.ai',
        metadata: {
          meeting_id,
          date,
          participants,
          duration,
          platform: 'read.ai'
        },
        // Default to first company for now - in production this would be determined by webhook config
        companyId: 1
      };

      const result = await storeWebhookContent(content);
      
      await addContentJob('generate-hooks', {
        contentSourceId: result.contentSourceId,
        companyId: content.companyId
      });

      logger.info('Read.ai webhook processed', {
        meetingId: meeting_id,
        contentSourceId: result.contentSourceId
      });

      res.json({
        success: true,
        message: 'Marketing Machine is processing your Read.ai transcript',
        contentSourceId: result.contentSourceId
      });

    } catch (error) {
      logger.error('Read.ai webhook error', { error: error.message });
      res.status(500).json({ error: 'Processing failed' });
    }
  });

  /**
   * Otter.ai webhook endpoint
   */
  app.post('/webhook/otter-ai', async (req, res) => {
    try {
      const { id, title, transcript_text, created_at, summary, speakers } = req.body;

      if (!transcript_text) {
        return res.status(400).json({ error: 'No transcript provided' });
      }

      const content = {
        title: title || `Otter.ai Recording - ${new Date().toLocaleDateString()}`,
        content: transcript_text,
        contentType: 'meeting_transcript',
        source: 'otter.ai',
        metadata: {
          otter_id: id,
          created_at,
          summary,
          speakers,
          platform: 'otter.ai'
        },
        companyId: 1 // Default company
      };

      const result = await storeWebhookContent(content);
      
      await addContentJob('generate-hooks', {
        contentSourceId: result.contentSourceId,
        companyId: content.companyId
      });

      logger.info('Otter.ai webhook processed', {
        otterId: id,
        contentSourceId: result.contentSourceId
      });

      res.json({
        success: true,
        message: 'Marketing Machine is processing your Otter.ai transcript',
        contentSourceId: result.contentSourceId
      });

    } catch (error) {
      logger.error('Otter.ai webhook error', { error: error.message });
      res.status(500).json({ error: 'Processing failed' });
    }
  });

  /**
   * Zoom webhook endpoint
   */
  app.post('/webhook/zoom', async (req, res) => {
    try {
      const { event, payload } = req.body;

      // Handle different Zoom webhook events
      if (event === 'recording.completed' && payload?.object?.recording_files) {
        const { topic, start_time, recording_files } = payload.object;
        
        // Look for transcript file
        const transcriptFile = recording_files.find(file => 
          file.file_type === 'TRANSCRIPT' || file.file_type === 'VTT'
        );

        if (!transcriptFile) {
          return res.status(400).json({ error: 'No transcript file found' });
        }

        // In production, you would fetch the transcript from Zoom's API
        // For now, we'll expect it to be in the payload
        const transcript = payload.transcript || 'Transcript content would be fetched from Zoom API';

        const content = {
          title: topic || `Zoom Meeting - ${new Date().toLocaleDateString()}`,
          content: transcript,
          contentType: 'meeting_transcript',
          source: 'zoom',
          metadata: {
            meeting_id: payload.object.id,
            start_time,
            transcript_url: transcriptFile.download_url,
            platform: 'zoom'
          },
          companyId: 1
        };

        const result = await storeWebhookContent(content);
        
        await addContentJob('generate-hooks', {
          contentSourceId: result.contentSourceId,
          companyId: content.companyId
        });

        logger.info('Zoom webhook processed', {
          meetingId: payload.object.id,
          contentSourceId: result.contentSourceId
        });

        res.json({
          success: true,
          message: 'Marketing Machine is processing your Zoom transcript',
          contentSourceId: result.contentSourceId
        });
      } else {
        logger.info('Zoom webhook event ignored', { event });
        res.json({ success: true, message: 'Event acknowledged but not processed' });
      }

    } catch (error) {
      logger.error('Zoom webhook error', { error: error.message });
      res.status(500).json({ error: 'Processing failed' });
    }
  });

  // =============================================
  // WEBHOOK TESTING ENDPOINT
  // =============================================

  /**
   * Test webhook endpoint for development
   */
  app.post('/webhook/test', async (req, res) => {
    try {
      const testContent = {
        title: 'Test Webhook Content',
        content: req.body.content || 'This is test content for Marketing Machine webhook processing.',
        contentType: 'meeting_transcript',
        source: 'test',
        metadata: {
          test: true,
          timestamp: new Date().toISOString()
        },
        companyId: 1
      };

      const result = await storeWebhookContent(testContent);
      
      // Don't trigger actual processing in test mode unless specified
      if (req.body.triggerProcessing) {
        await addContentJob('generate-hooks', {
          contentSourceId: result.contentSourceId,
          companyId: testContent.companyId
        });
      }

      logger.info('Test webhook processed', {
        contentSourceId: result.contentSourceId,
        triggerProcessing: !!req.body.triggerProcessing
      });

      res.json({
        success: true,
        message: 'Test webhook processed successfully',
        contentSourceId: result.contentSourceId,
        processingTriggered: !!req.body.triggerProcessing
      });

    } catch (error) {
      logger.error('Test webhook error', { error: error.message });
      res.status(500).json({ error: 'Test processing failed' });
    }
  });

  // Start webhook server
  const server = app.listen(port, '0.0.0.0', () => {
    logger.info(`🎣 Marketing Machine Webhook Server running on port ${port}`);
    logger.info(`📡 Webhook endpoints:`);
    logger.info(`   Generic: http://localhost:${port}/webhook/meeting-recorder`);
    logger.info(`   Read.ai: http://localhost:${port}/webhook/read-ai`);
    logger.info(`   Otter.ai: http://localhost:${port}/webhook/otter-ai`);
    logger.info(`   Zoom: http://localhost:${port}/webhook/zoom`);
    logger.info(`   Test: http://localhost:${port}/webhook/test`);
  });

  return server;
}

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Process webhook payload and extract content
 * @param {Object} payload - Webhook payload
 * @param {string} source - Webhook source
 * @param {Object} headers - Request headers
 * @returns {Object|null} Processed content
 */
function processWebhookPayload(payload, source, headers) {
  try {
    // Generic payload processing - adapt based on source
    let title, content, contentType = 'meeting_transcript', metadata = {};

    switch (source.toLowerCase()) {
      case 'read.ai':
        title = payload.title || payload.meeting_title;
        content = payload.transcript || payload.transcript_text;
        metadata = {
          meeting_id: payload.meeting_id,
          date: payload.date || payload.created_at,
          participants: payload.participants,
          duration: payload.duration
        };
        break;

      case 'otter.ai':
        title = payload.title;
        content = payload.transcript_text || payload.transcript;
        metadata = {
          otter_id: payload.id,
          created_at: payload.created_at,
          summary: payload.summary,
          speakers: payload.speakers
        };
        break;

      case 'zoom':
        if (payload.event === 'recording.completed' && payload.payload) {
          title = payload.payload.object.topic;
          content = payload.transcript; // Would be fetched from Zoom API
          metadata = {
            meeting_id: payload.payload.object.id,
            start_time: payload.payload.object.start_time
          };
        }
        break;

      default:
        // Try to extract common fields
        title = payload.title || payload.subject || payload.meeting_title || 'Webhook Content';
        content = payload.transcript || payload.transcript_text || payload.content || payload.text;
        metadata = {
          raw_payload: payload,
          source,
          user_agent: headers['user-agent']
        };
    }

    if (!content) {
      return null;
    }

    return {
      title,
      content,
      contentType,
      source,
      metadata: {
        ...metadata,
        platform: source,
        webhook_received_at: new Date().toISOString()
      },
      companyId: 1 // Default company - in production this would be mapped from webhook config
    };

  } catch (error) {
    logger.error('Payload processing error', { error: error.message, payload });
    return null;
  }
}

/**
 * Store webhook content in database
 * @param {Object} content - Content to store
 * @returns {Object} Storage result
 */
async function storeWebhookContent(content) {
  return await transaction(async (client) => {
    // Insert content source
    const contentResult = await client.query(`
      INSERT INTO content_sources 
      (company_id, source_type, source_name, title, content, content_type, metadata)
      VALUES ($1, 'webhook', $2, $3, $4, $5, $6)
      RETURNING id, uuid
    `, [
      content.companyId,
      content.source,
      content.title,
      content.content,
      content.contentType,
      JSON.stringify(content.metadata)
    ]);

    const contentSourceId = contentResult.rows[0].id;
    const contentUuid = contentResult.rows[0].uuid;

    // Create processing batch
    const batchResult = await client.query(`
      INSERT INTO processing_batches 
      (content_source_id, company_id, status, started_at)
      VALUES ($1, $2, 'pending', NOW())
      RETURNING id, uuid
    `, [contentSourceId, content.companyId]);

    const processingBatchId = batchResult.rows[0].id;
    const batchUuid = batchResult.rows[0].uuid;

    logger.info('Webhook content stored', {
      contentSourceId,
      processingBatchId,
      title: content.title,
      source: content.source
    });

    return {
      contentSourceId,
      contentUuid,
      processingBatchId,
      batchUuid
    };
  });
}

/**
 * Verify webhook signature for security
 * @param {Object} payload - Request payload
 * @param {string} signature - Provided signature
 * @param {string} secret - Webhook secret
 * @returns {boolean} Signature is valid
 */
function verifyWebhookSignature(payload, signature, secret) {
  try {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    const calculatedSignature = hmac.digest('hex');
    
    // Support different signature formats
    const providedSig = signature.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(calculatedSignature, 'hex'),
      Buffer.from(providedSig, 'hex')
    );
  } catch (error) {
    logger.error('Signature verification error', { error: error.message });
    return false;
  }
}

module.exports = {
  startWebhookServer,
  processWebhookPayload,
  storeWebhookContent,
  verifyWebhookSignature
};