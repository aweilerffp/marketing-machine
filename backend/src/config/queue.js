/**
 * Marketing Machine - Job Queue Configuration
 * Bull queue for processing content and AI tasks
 */

const Queue = require('bull');
const logger = require('../utils/logger').queue;

// Job queues
let contentProcessingQueue;
let imageGenerationQueue;
let publishingQueue;

/**
 * Initialize job queues
 */
async function initializeQueue() {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    // Content Processing Queue (hooks and posts generation)
    contentProcessingQueue = new Queue('content processing', redisUrl, {
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    // Image Generation Queue
    imageGenerationQueue = new Queue('image generation', redisUrl, {
      defaultJobOptions: {
        removeOnComplete: 5,
        removeOnFail: 3,
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    // Publishing Queue  
    publishingQueue = new Queue('publishing', redisUrl, {
      defaultJobOptions: {
        removeOnComplete: 20,
        removeOnFail: 10,
        attempts: 3,
        delay: 1000, // 1 second delay between retries
      },
    });

    // Set up queue event handlers
    setupQueueEventHandlers();

    // Set up job processors
    setupJobProcessors();

    logger.info('Job queues initialized successfully', {
      queues: ['content processing', 'image generation', 'publishing']
    });

    return {
      contentProcessingQueue,
      imageGenerationQueue,
      publishingQueue
    };

  } catch (error) {
    logger.error('Failed to initialize job queues', { error: error.message });
    throw error;
  }
}

/**
 * Set up event handlers for all queues
 */
function setupQueueEventHandlers() {
  const queues = [
    { name: 'content processing', queue: contentProcessingQueue },
    { name: 'image generation', queue: imageGenerationQueue },
    { name: 'publishing', queue: publishingQueue }
  ];

  queues.forEach(({ name, queue }) => {
    queue.on('completed', (job, result) => {
      logger.info(`${name} job completed`, {
        jobId: job.id,
        duration: `${Date.now() - job.timestamp}ms`,
        result: typeof result === 'object' ? 'object' : result
      });
    });

    queue.on('failed', (job, err) => {
      logger.error(`${name} job failed`, {
        jobId: job.id,
        attempt: job.attemptsMade,
        maxAttempts: job.opts.attempts,
        error: err.message,
        data: job.data
      });
    });

    queue.on('active', (job, jobPromise) => {
      logger.debug(`${name} job started`, {
        jobId: job.id,
        data: job.data
      });
    });

    queue.on('stalled', (job) => {
      logger.warn(`${name} job stalled`, {
        jobId: job.id,
        data: job.data
      });
    });
  });
}

/**
 * Set up job processors
 */
function setupJobProcessors() {
  // Import job processors
  const { processContent } = require('../services/ai/contentProcessor');
  const { processImageGeneration } = require('../services/ai/imageProcessor');
  const { processPublishing } = require('../services/publishing/publishProcessor');

  // Content Processing Jobs
  contentProcessingQueue.process('generate-hooks', 2, async (job) => {
    const { contentSourceId, companyId } = job.data;
    logger.info('Processing hooks generation job', { contentSourceId, companyId });
    
    return await processContent.generateHooks(contentSourceId, companyId);
  });

  contentProcessingQueue.process('generate-posts', 3, async (job) => {
    const { hookIds, companyId } = job.data;
    logger.info('Processing posts generation job', { hookIds, companyId });
    
    return await processContent.generatePosts(hookIds, companyId);
  });

  // Image Generation Jobs
  imageGenerationQueue.process('generate-image', 1, async (job) => {
    const { postId, imageModel, prompt } = job.data;
    logger.info('Processing image generation job', { postId, imageModel });
    
    return await processImageGeneration(postId, imageModel, prompt);
  });

  // Publishing Jobs
  publishingQueue.process('publish-post', 5, async (job) => {
    const { postId, platform, scheduledTime } = job.data;
    logger.info('Processing publishing job', { postId, platform, scheduledTime });
    
    return await processPublishing(postId, platform, scheduledTime);
  });
}

/**
 * Add job to content processing queue
 * @param {string} jobType - Type of job (generate-hooks, generate-posts)
 * @param {Object} jobData - Job data
 * @param {Object} options - Job options
 */
async function addContentJob(jobType, jobData, options = {}) {
  try {
    const job = await contentProcessingQueue.add(jobType, jobData, {
      priority: options.priority || 0,
      delay: options.delay || 0,
      ...options
    });

    logger.info('Content job added to queue', {
      jobId: job.id,
      jobType,
      data: jobData
    });

    return job;
  } catch (error) {
    logger.error('Failed to add content job to queue', {
      jobType,
      data: jobData,
      error: error.message
    });
    throw error;
  }
}

/**
 * Add job to image generation queue
 * @param {Object} jobData - Job data
 * @param {Object} options - Job options
 */
async function addImageJob(jobData, options = {}) {
  try {
    const job = await imageGenerationQueue.add('generate-image', jobData, {
      priority: options.priority || 0,
      delay: options.delay || 0,
      ...options
    });

    logger.info('Image generation job added to queue', {
      jobId: job.id,
      data: jobData
    });

    return job;
  } catch (error) {
    logger.error('Failed to add image job to queue', {
      data: jobData,
      error: error.message
    });
    throw error;
  }
}

/**
 * Add job to publishing queue
 * @param {Object} jobData - Job data  
 * @param {Object} options - Job options
 */
async function addPublishingJob(jobData, options = {}) {
  try {
    const job = await publishingQueue.add('publish-post', jobData, {
      priority: options.priority || 0,
      delay: options.delay || 0,
      ...options
    });

    logger.info('Publishing job added to queue', {
      jobId: job.id,
      data: jobData
    });

    return job;
  } catch (error) {
    logger.error('Failed to add publishing job to queue', {
      data: jobData,
      error: error.message
    });
    throw error;
  }
}

/**
 * Get queue statistics
 * @returns {Promise<Object>} Queue stats
 */
async function getQueueStats() {
  try {
    const stats = {
      contentProcessing: {
        waiting: await contentProcessingQueue.getWaiting(),
        active: await contentProcessingQueue.getActive(),
        completed: await contentProcessingQueue.getCompleted(),
        failed: await contentProcessingQueue.getFailed(),
      },
      imageGeneration: {
        waiting: await imageGenerationQueue.getWaiting(),
        active: await imageGenerationQueue.getActive(),
        completed: await imageGenerationQueue.getCompleted(),
        failed: await imageGenerationQueue.getFailed(),
      },
      publishing: {
        waiting: await publishingQueue.getWaiting(),
        active: await publishingQueue.getActive(),
        completed: await publishingQueue.getCompleted(),
        failed: await publishingQueue.getFailed(),
      }
    };

    // Convert job counts
    Object.keys(stats).forEach(queueName => {
      Object.keys(stats[queueName]).forEach(status => {
        stats[queueName][status] = stats[queueName][status].length;
      });
    });

    return stats;
  } catch (error) {
    logger.error('Failed to get queue stats', { error: error.message });
    throw error;
  }
}

/**
 * Health check for queues
 * @returns {Promise<Object>} Health status
 */
async function healthCheck() {
  try {
    const stats = await getQueueStats();
    const totalJobs = Object.values(stats).reduce((total, queue) => {
      return total + queue.waiting + queue.active + queue.failed;
    }, 0);

    return {
      status: 'healthy',
      totalJobs,
      queues: stats
    };
  } catch (error) {
    logger.error('Queue health check failed', { error: error.message });
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

/**
 * Close all queues
 */
async function closeQueues() {
  logger.info('Closing job queues...');
  
  const closePromises = [];
  
  if (contentProcessingQueue) {
    closePromises.push(contentProcessingQueue.close());
  }
  
  if (imageGenerationQueue) {
    closePromises.push(imageGenerationQueue.close());
  }
  
  if (publishingQueue) {
    closePromises.push(publishingQueue.close());
  }

  await Promise.all(closePromises);
  logger.info('Job queues closed');
}

module.exports = {
  initializeQueue,
  addContentJob,
  addImageJob,
  addPublishingJob,
  getQueueStats,
  healthCheck,
  closeQueues,
  
  // Direct queue access (use carefully)
  getContentQueue: () => contentProcessingQueue,
  getImageQueue: () => imageGenerationQueue,
  getPublishingQueue: () => publishingQueue
};