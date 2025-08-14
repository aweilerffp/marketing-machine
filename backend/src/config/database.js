/**
 * Marketing Machine - Database Configuration
 * PostgreSQL connection and query management
 */

const { Pool } = require('pg');
const logger = require('../utils/logger').database;

// Database configuration
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection could not be established
  maxUses: 7500, // Close (and replace) a connection after it has been used 7500 times
};

// Create connection pool
let pool;

/**
 * Initialize database connection
 */
async function connectDatabase() {
  try {
    pool = new Pool(dbConfig);
    
    // Test the connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    client.release();
    
    logger.info('Database connected successfully', {
      currentTime: result.rows[0].current_time,
      version: result.rows[0].version.split(' ')[0] // Just get PostgreSQL version
    });

    // Set up pool event handlers
    pool.on('connect', (client) => {
      logger.debug('New client connected', { 
        totalCount: pool.totalCount,
        idleCount: pool.idleCount 
      });
    });

    pool.on('error', (err, client) => {
      logger.error('Unexpected error on idle client', { error: err.message });
    });

    pool.on('remove', (client) => {
      logger.debug('Client removed from pool', {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount
      });
    });

    return pool;
  } catch (error) {
    logger.error('Failed to connect to database', { error: error.message });
    throw error;
  }
}

/**
 * Execute a query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params = []) {
  const start = Date.now();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    logger.debug('Executed query', {
      duration: `${duration}ms`,
      rows: result.rowCount,
      query: text.substring(0, 100) + (text.length > 100 ? '...' : '')
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Query error', {
      duration: `${duration}ms`,
      error: error.message,
      query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      params: params.length > 0 ? 'yes' : 'no'
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Object>} Database client
 */
async function getClient() {
  try {
    return await pool.connect();
  } catch (error) {
    logger.error('Failed to get client from pool', { error: error.message });
    throw error;
  }
}

/**
 * Execute multiple queries in a transaction
 * @param {Function} callback - Function that receives client and executes queries
 * @returns {Promise<any>} Transaction result
 */
async function transaction(callback) {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    
    logger.debug('Transaction completed successfully');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction rolled back', { error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Health check for database
 * @returns {Promise<Object>} Health status
 */
async function healthCheck() {
  try {
    const start = Date.now();
    const result = await query('SELECT 1 as alive');
    const responseTime = Date.now() - start;
    
    return {
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      totalConnections: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingCount: pool.waitingCount
    };
  } catch (error) {
    logger.error('Database health check failed', { error: error.message });
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

/**
 * Close database connections
 */
async function closeDatabase() {
  if (pool) {
    logger.info('Closing database connections...');
    await pool.end();
    logger.info('Database connections closed');
  }
}

// Export database functions
module.exports = {
  connectDatabase,
  query,
  getClient,
  transaction,
  healthCheck,
  closeDatabase,
  pool: () => pool // Getter function to access pool
};