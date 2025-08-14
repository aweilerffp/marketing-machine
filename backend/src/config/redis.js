/**
 * Marketing Machine - Redis Configuration
 * Redis connection for caching and job queue
 */

const redis = require('redis');
const logger = require('../utils/logger').createComponentLogger('redis');

let redisClient;
let isConnected = false;

/**
 * Connect to Redis
 * @returns {Promise<Object>} Redis client
 */
async function connectRedis() {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = redis.createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            logger.error('Redis reconnection failed after 5 attempts');
            return false;
          }
          return Math.min(retries * 50, 1000);
        }
      },
      // Retry configuration
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.error('Redis server connection refused');
          return new Error('The server refused the connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          logger.error('Redis retry time exhausted');
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          logger.error('Redis max retry attempts reached');
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    // Event handlers
    redisClient.on('connect', () => {
      logger.info('Connected to Redis server');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
      isConnected = true;
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error', { error: err.message });
      isConnected = false;
    });

    redisClient.on('end', () => {
      logger.info('Redis connection closed');
      isConnected = false;
    });

    redisClient.on('reconnecting', () => {
      logger.info('Reconnecting to Redis...');
    });

    // Connect to Redis
    await redisClient.connect();
    
    // Test the connection
    const pong = await redisClient.ping();
    logger.info('Redis connection test successful', { response: pong });

    return redisClient;
    
  } catch (error) {
    logger.error('Failed to connect to Redis', { error: error.message });
    throw error;
  }
}

/**
 * Get Redis client instance
 * @returns {Object} Redis client
 */
function getRedisClient() {
  if (!redisClient || !isConnected) {
    throw new Error('Redis client is not connected');
  }
  return redisClient;
}

/**
 * Cache operations
 */
const cache = {
  /**
   * Set cache value
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (default: 3600)
   */
  async set(key, value, ttl = 3600) {
    try {
      const client = getRedisClient();
      const serialized = JSON.stringify(value);
      await client.setEx(key, ttl, serialized);
      logger.debug('Cache set', { key, ttl: `${ttl}s` });
    } catch (error) {
      logger.error('Cache set error', { key, error: error.message });
      throw error;
    }
  },

  /**
   * Get cache value
   * @param {string} key - Cache key
   * @returns {any} Cached value or null
   */
  async get(key) {
    try {
      const client = getRedisClient();
      const value = await client.get(key);
      
      if (value === null) {
        logger.debug('Cache miss', { key });
        return null;
      }
      
      const parsed = JSON.parse(value);
      logger.debug('Cache hit', { key });
      return parsed;
    } catch (error) {
      logger.error('Cache get error', { key, error: error.message });
      throw error;
    }
  },

  /**
   * Delete cache value
   * @param {string} key - Cache key
   */
  async del(key) {
    try {
      const client = getRedisClient();
      const result = await client.del(key);
      logger.debug('Cache delete', { key, deleted: result === 1 });
      return result;
    } catch (error) {
      logger.error('Cache delete error', { key, error: error.message });
      throw error;
    }
  },

  /**
   * Check if key exists
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists
   */
  async exists(key) {
    try {
      const client = getRedisClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Cache exists error', { key, error: error.message });
      throw error;
    }
  },

  /**
   * Set cache value with expiration timestamp
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {Date} expireAt - Expiration timestamp
   */
  async setExpireAt(key, value, expireAt) {
    try {
      const client = getRedisClient();
      const serialized = JSON.stringify(value);
      await client.set(key, serialized);
      await client.expireAt(key, Math.floor(expireAt.getTime() / 1000));
      logger.debug('Cache set with expire at', { key, expireAt });
    } catch (error) {
      logger.error('Cache setExpireAt error', { key, error: error.message });
      throw error;
    }
  }
};

/**
 * Session operations for user sessions
 */
const session = {
  /**
   * Store user session
   * @param {string} sessionId - Session ID
   * @param {Object} sessionData - Session data
   * @param {number} ttl - Time to live in seconds
   */
  async set(sessionId, sessionData, ttl = 86400) { // 24 hours default
    const key = `session:${sessionId}`;
    await cache.set(key, sessionData, ttl);
    logger.debug('Session stored', { sessionId, ttl: `${ttl}s` });
  },

  /**
   * Get user session
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Session data
   */
  async get(sessionId) {
    const key = `session:${sessionId}`;
    const session = await cache.get(key);
    logger.debug('Session retrieved', { sessionId, found: !!session });
    return session;
  },

  /**
   * Delete user session
   * @param {string} sessionId - Session ID
   */
  async delete(sessionId) {
    const key = `session:${sessionId}`;
    await cache.del(key);
    logger.debug('Session deleted', { sessionId });
  }
};

/**
 * Rate limiting operations
 */
const rateLimit = {
  /**
   * Increment rate limit counter
   * @param {string} identifier - Unique identifier (IP, user ID, etc.)
   * @param {number} windowMs - Window in milliseconds
   * @param {number} maxRequests - Maximum requests per window
   * @returns {Object} Rate limit info
   */
  async increment(identifier, windowMs = 900000, maxRequests = 100) {
    try {
      const client = getRedisClient();
      const key = `ratelimit:${identifier}`;
      const window = Math.floor(Date.now() / windowMs);
      const windowKey = `${key}:${window}`;
      
      const current = await client.incr(windowKey);
      
      if (current === 1) {
        await client.expire(windowKey, Math.ceil(windowMs / 1000));
      }
      
      const remaining = Math.max(0, maxRequests - current);
      const resetTime = (window + 1) * windowMs;
      
      return {
        current,
        remaining,
        resetTime: new Date(resetTime),
        exceeded: current > maxRequests
      };
    } catch (error) {
      logger.error('Rate limit error', { identifier, error: error.message });
      throw error;
    }
  }
};

/**
 * Health check for Redis
 * @returns {Promise<Object>} Health status
 */
async function healthCheck() {
  try {
    if (!isConnected) {
      return {
        status: 'unhealthy',
        error: 'Redis client not connected'
      };
    }

    const start = Date.now();
    const result = await redisClient.ping();
    const responseTime = Date.now() - start;
    
    const info = await redisClient.info('memory');
    const memoryLines = info.split('\r\n');
    const usedMemory = memoryLines.find(line => line.startsWith('used_memory_human:'));
    
    return {
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      connected: isConnected,
      memory: usedMemory ? usedMemory.split(':')[1] : 'unknown'
    };
  } catch (error) {
    logger.error('Redis health check failed', { error: error.message });
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

/**
 * Close Redis connection
 */
async function closeRedis() {
  if (redisClient && isConnected) {
    logger.info('Closing Redis connection...');
    await redisClient.quit();
    logger.info('Redis connection closed');
  }
}

module.exports = {
  connectRedis,
  getRedisClient,
  cache,
  session,
  rateLimit,
  healthCheck,
  closeRedis
};