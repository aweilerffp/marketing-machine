/**
 * Debug webhook database storage
 */

require('dotenv').config();
const { transaction, query } = require('./src/config/database');
const { connectDatabase } = require('./src/config/database');

async function testWebhookStorage() {
  try {
    console.log('Connecting to database...');
    await connectDatabase();
    
    console.log('Testing transaction...');
    const result = await transaction(async (client) => {
      // Insert content source
      const contentResult = await client.query(`
        INSERT INTO content_sources 
        (company_id, source_type, source_name, title, content, content_type, metadata)
        VALUES ($1, 'webhook', $2, $3, $4, $5, $6)
        RETURNING id, uuid
      `, [
        1, // companyId
        'debug-test', // source
        'Debug Test Content', // title
        'This is debug test content', // content
        'meeting_transcript', // contentType
        JSON.stringify({ debug: true }) // metadata
      ]);

      const contentSourceId = contentResult.rows[0].id;
      const contentUuid = contentResult.rows[0].uuid;

      console.log('Content inserted:', { contentSourceId, contentUuid });

      // Create processing batch
      const batchResult = await client.query(`
        INSERT INTO processing_batches 
        (content_source_id, company_id, status, started_at)
        VALUES ($1, $2, 'pending', NOW())
        RETURNING id, uuid
      `, [contentSourceId, 1]);

      const processingBatchId = batchResult.rows[0].id;
      const batchUuid = batchResult.rows[0].uuid;

      console.log('Batch created:', { processingBatchId, batchUuid });

      return {
        contentSourceId,
        contentUuid,
        processingBatchId,
        batchUuid
      };
    });

    console.log('Transaction result:', result);

    // Verify data persisted
    const verification = await query('SELECT id, title FROM content_sources WHERE id = $1', [result.contentSourceId]);
    console.log('Verification:', verification.rows[0]);

  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

testWebhookStorage();