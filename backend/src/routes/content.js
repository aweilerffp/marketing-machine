/**
 * Marketing Machine - Content Routes
 * Manual content input and processing management
 */

const express = require('express');
const multer = require('multer');
const { query } = require('../config/database');
const { addContentJob } = require('../config/queue');
const { processContent } = require('../services/ai/contentProcessor');
const logger = require('../utils/logger').api;
const { ValidationError } = require('../middleware/errorHandler');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(txt|pdf|docx|md)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only TXT, PDF, DOCX, and MD files are allowed.'));
    }
  }
});

// =============================================
// MANUAL CONTENT SUBMISSION
// =============================================

/**
 * Submit manual content for processing
 */
router.post('/manual', [
  body('content').notEmpty().withMessage('Content is required').isLength({ min: 50 }).withMessage('Content must be at least 50 characters'),
  body('title').optional().isLength({ max: 255 }).withMessage('Title must be 255 characters or less'),
  body('content_type').optional().isIn(['meeting_transcript', 'sales_call', 'product_update', 'customer_success', 'blog_post', 'general_notes']).withMessage('Invalid content type'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid content submission', errors.array());
    }

    const { companyId } = req.user;
    const { 
      content, 
      title, 
      content_type = 'meeting_transcript', 
      metadata = {} 
    } = req.body;

    logger.info('Manual content submission', {
      companyId,
      contentLength: content.length,
      contentType: content_type,
      hasTitle: !!title
    });

    // Store content source
    const contentResult = await query(`
      INSERT INTO content_sources 
      (company_id, user_id, source_type, source_name, title, content, content_type, metadata)
      VALUES ($1, $2, 'manual', 'manual_input', $3, $4, $5, $6)
      RETURNING id, uuid
    `, [
      companyId,
      req.user.id,
      title || `Manual Content - ${new Date().toLocaleDateString()}`,
      content,
      content_type,
      JSON.stringify({
        ...metadata,
        submission_method: 'api',
        submitted_by: req.user.id,
        submitted_at: new Date().toISOString()
      })
    ]);

    const contentSourceId = contentResult.rows[0].id;
    const contentUuid = contentResult.rows[0].uuid;

    // Create processing batch
    const batchResult = await query(`
      INSERT INTO processing_batches 
      (content_source_id, company_id, status, started_at)
      VALUES ($1, $2, 'pending', NOW())
      RETURNING id, uuid
    `, [contentSourceId, companyId]);

    const batchId = batchResult.rows[0].id;
    const batchUuid = batchResult.rows[0].uuid;

    // Add to processing queue
    await addContentJob('generate-hooks', {
      contentSourceId,
      companyId
    }, {
      priority: 1, // High priority for manual submissions
      delay: 1000   // Small delay to allow response to be sent
    });

    logger.info('Manual content queued for processing', {
      contentSourceId,
      batchId,
      companyId
    });

    res.status(201).json({
      success: true,
      message: 'Marketing Machine is processing your content',
      content_source_id: contentSourceId,
      batch_id: batchId,
      batch_uuid: batchUuid,
      estimated_completion_time: '30-60 seconds',
      next_steps: [
        'Marketing Machine will extract 10 marketing hooks',
        'Generate LinkedIn posts from each hook',
        'Create branded images for posts',
        'Send to approval workflow'
      ]
    });

  } catch (error) {
    logger.error('Manual content submission error', {
      error: error.message,
      companyId: req.user?.companyId,
      contentLength: req.body?.content?.length
    });

    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message, details: error.details });
    } else {
      res.status(500).json({ error: 'Failed to submit content for processing' });
    }
  }
});

/**
 * Upload file for content processing
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { companyId } = req.user;
    const file = req.file;

    logger.info('File upload for processing', {
      companyId,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype
    });

    // Extract text content from file
    const content = await extractTextFromFile(file);

    if (!content || content.length < 50) {
      return res.status(400).json({ 
        error: 'File content is too short or could not be extracted',
        details: 'Files must contain at least 50 characters of text'
      });
    }

    // Determine content type from filename or use default
    const contentType = determineContentTypeFromFilename(file.originalname);

    // Store content source
    const contentResult = await query(`
      INSERT INTO content_sources 
      (company_id, user_id, source_type, source_name, title, content, content_type, metadata)
      VALUES ($1, $2, 'upload', 'file_upload', $3, $4, $5, $6)
      RETURNING id, uuid
    `, [
      companyId,
      req.user.id,
      file.originalname,
      content,
      contentType,
      JSON.stringify({
        original_filename: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype,
        uploaded_by: req.user.id,
        uploaded_at: new Date().toISOString()
      })
    ]);

    const contentSourceId = contentResult.rows[0].id;

    // Create processing batch
    const batchResult = await query(`
      INSERT INTO processing_batches 
      (content_source_id, company_id, status, started_at)
      VALUES ($1, $2, 'pending', NOW())
      RETURNING id, uuid
    `, [contentSourceId, companyId]);

    const batchId = batchResult.rows[0].id;

    // Add to processing queue
    await addContentJob('generate-hooks', {
      contentSourceId,
      companyId
    });

    logger.info('File content queued for processing', {
      contentSourceId,
      batchId,
      fileName: file.originalname,
      contentLength: content.length
    });

    res.json({
      success: true,
      message: 'File processed and queued for Marketing Machine',
      file: {
        name: file.originalname,
        size: file.size,
        content_length: content.length
      },
      content_source_id: contentSourceId,
      batch_id: batchId,
      content_preview: content.substring(0, 200) + (content.length > 200 ? '...' : '')
    });

  } catch (error) {
    logger.error('File upload error', {
      error: error.message,
      fileName: req.file?.originalname,
      companyId: req.user?.companyId
    });

    res.status(500).json({ 
      error: 'Failed to process uploaded file',
      details: error.message 
    });
  }
});

// =============================================
// PROCESSING STATUS AND RESULTS
// =============================================

/**
 * Get processing status for a batch
 */
router.get('/processing/:batchId', async (req, res) => {
  try {
    const { companyId } = req.user;
    const { batchId } = req.params;

    const status = await processContent.getProcessingStatus(batchId);

    if (!status) {
      return res.status(404).json({ error: 'Processing batch not found' });
    }

    // Verify ownership
    const ownershipCheck = await query(`
      SELECT company_id FROM processing_batches WHERE id = $1
    `, [batchId]);

    if (ownershipCheck.rows[0]?.company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      status: status.status,
      progress: {
        current_step: status.current_step,
        total_steps: status.total_steps,
        step_details: status.step_details
      },
      content: {
        title: status.content_title,
        type: status.content_type
      },
      results: {
        hooks_generated: status.hooks_generated
      },
      timestamps: {
        started_at: status.started_at,
        completed_at: status.completed_at,
        estimated_completion: status.estimated_completion
      }
    });

  } catch (error) {
    logger.error('Get processing status error', {
      error: error.message,
      batchId: req.params.batchId,
      companyId: req.user?.companyId
    });
    res.status(500).json({ error: 'Failed to get processing status' });
  }
});

/**
 * Get processing batches for company
 */
router.get('/batches', async (req, res) => {
  try {
    const { companyId } = req.user;
    const { limit = 20, status } = req.query;

    let whereClause = 'WHERE pb.company_id = $1';
    const params = [companyId];

    if (status) {
      whereClause += ' AND pb.status = $2';
      params.push(status);
    }

    const result = await query(`
      SELECT 
        pb.id,
        pb.uuid,
        pb.status,
        pb.current_step,
        pb.total_steps,
        pb.created_at,
        pb.completed_at,
        cs.title as content_title,
        cs.source_name,
        cs.content_type,
        COUNT(mh.id) as hooks_generated
      FROM processing_batches pb
      JOIN content_sources cs ON cs.id = pb.content_source_id
      LEFT JOIN marketing_hooks mh ON mh.processing_batch_id = pb.id
      ${whereClause}
      GROUP BY pb.id, cs.id
      ORDER BY pb.created_at DESC
      LIMIT $${params.length + 1}
    `, [...params, limit]);

    res.json({
      batches: result.rows.map(batch => ({
        id: batch.id,
        uuid: batch.uuid,
        status: batch.status,
        progress: {
          current_step: batch.current_step,
          total_steps: batch.total_steps
        },
        content: {
          title: batch.content_title,
          source: batch.source_name,
          type: batch.content_type
        },
        results: {
          hooks_generated: parseInt(batch.hooks_generated)
        },
        timestamps: {
          created_at: batch.created_at,
          completed_at: batch.completed_at
        }
      })),
      total: result.rows.length
    });

  } catch (error) {
    logger.error('Get processing batches error', {
      error: error.message,
      companyId: req.user?.companyId
    });
    res.status(500).json({ error: 'Failed to get processing batches' });
  }
});

/**
 * Get hooks for a processing batch
 */
router.get('/hooks/:batchId', async (req, res) => {
  try {
    const { companyId } = req.user;
    const { batchId } = req.params;

    // Verify ownership
    const ownershipCheck = await query(`
      SELECT company_id FROM processing_batches WHERE id = $1
    `, [batchId]);

    if (ownershipCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Processing batch not found' });
    }

    if (ownershipCheck.rows[0].company_id !== companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const hooks = await processContent.getHooksForBatch(batchId);

    res.json({
      batch_id: batchId,
      hooks: hooks.map(hook => ({
        id: hook.id,
        uuid: hook.uuid,
        hook_text: hook.hook_text,
        hook_type: hook.hook_type,
        content_pillar: hook.content_pillar,
        source_quote: hook.source_quote,
        linkedin_version: hook.linkedin_hook,
        twitter_version: hook.tweet_version,
        blog_title: hook.blog_title,
        scores: {
          relevance: hook.relevance_score,
          engagement_prediction: hook.engagement_potential,
          priority: hook.priority
        },
        status: hook.status,
        created_at: hook.created_at
      })),
      total: hooks.length
    });

  } catch (error) {
    logger.error('Get hooks error', {
      error: error.message,
      batchId: req.params.batchId,
      companyId: req.user?.companyId
    });
    res.status(500).json({ error: 'Failed to get hooks' });
  }
});

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Extract text content from uploaded file
 * @param {Object} file - Uploaded file
 * @returns {Promise<string>} Extracted text
 */
async function extractTextFromFile(file) {
  const fileType = file.mimetype || file.originalname.split('.').pop().toLowerCase();

  try {
    if (fileType === 'text/plain' || file.originalname.endsWith('.txt') || file.originalname.endsWith('.md')) {
      return file.buffer.toString('utf-8');
    }

    // For PDF and DOCX files, we would normally use specialized libraries
    // For now, return error suggesting manual input
    if (fileType === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      throw new Error('PDF parsing not yet implemented. Please copy and paste the text content instead.');
    }

    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.originalname.endsWith('.docx')) {
      throw new Error('DOCX parsing not yet implemented. Please copy and paste the text content instead.');
    }

    throw new Error('Unsupported file type');

  } catch (error) {
    logger.error('File text extraction error', {
      error: error.message,
      fileName: file.originalname,
      fileType
    });
    throw error;
  }
}

/**
 * Determine content type from filename
 * @param {string} filename - Original filename
 * @returns {string} Content type
 */
function determineContentTypeFromFilename(filename) {
  const lower = filename.toLowerCase();

  if (lower.includes('meeting') || lower.includes('transcript')) {
    return 'meeting_transcript';
  }
  if (lower.includes('sales') || lower.includes('call')) {
    return 'sales_call';
  }
  if (lower.includes('product') || lower.includes('update')) {
    return 'product_update';
  }
  if (lower.includes('customer') || lower.includes('success')) {
    return 'customer_success';
  }
  if (lower.includes('blog') || lower.includes('post')) {
    return 'blog_post';
  }

  return 'general_notes';
}

module.exports = router;