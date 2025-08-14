/**
 * Marketing Machine - Main Routes
 * Central routing configuration
 */

const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const companyRoutes = require('./companies');
const contentRoutes = require('./content');
const webhookRoutes = require('./webhooks');
const postRoutes = require('./posts');
const imageRoutes = require('./images');
const aiRoutes = require('./ai');
const publishingRoutes = require('./publishing');
const analyticsRoutes = require('./analytics');

// Import middleware
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

// API Documentation
router.get('/', (req, res) => {
  res.json({
    name: 'Marketing Machine API',
    version: '1.0.0',
    description: 'Automated LinkedIn content creation from meeting recordings',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth/*',
      companies: '/api/companies/*',
      content: '/api/content/*',
      posts: '/api/posts/*',
      images: '/api/images/*',
      webhooks: '/api/webhooks/*',
      ai: '/api/ai/*',
      publishing: '/api/publishing/*',
      analytics: '/api/analytics/*'
    },
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const { healthCheck: dbHealth } = require('../config/database');
    const { healthCheck: redisHealth } = require('../config/redis');
    const { healthCheck: queueHealth } = require('../config/queue');

    const [database, redis, queue] = await Promise.all([
      dbHealth(),
      redisHealth(),
      queueHealth()
    ]);

    const overallStatus = (database.status === 'healthy' && 
                          redis.status === 'healthy' && 
                          queue.status === 'healthy') ? 'healthy' : 'degraded';

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        database,
        redis,
        queue
      },
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// =============================================
// PUBLIC ROUTES (No authentication required)
// =============================================

// Authentication routes
router.use('/auth', authRoutes);

// Webhook routes (external services)
router.use('/webhooks', webhookRoutes);

// =============================================
// PROTECTED ROUTES (Authentication required)
// =============================================

// Apply authentication middleware to all routes below this point
router.use(authenticateToken);

// Company management
router.use('/companies', companyRoutes);

// Content management (manual input, processing)
router.use('/content', contentRoutes);

// LinkedIn posts management
router.use('/posts', postRoutes);

// AI-generated images management
router.use('/images', imageRoutes);

// AI services (hooks, posts, images)
router.use('/ai', aiRoutes);

// Publishing and scheduling
router.use('/publishing', publishingRoutes);

// Analytics and reporting
router.use('/analytics', analyticsRoutes);

// =============================================
// ERROR HANDLING
// =============================================

// Handle 404 for API routes
router.use('*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'GET /api/',
      'GET /api/health',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/companies',
      'POST /api/content/manual',
      'POST /api/webhooks/meeting-recorder'
    ],
    documentation: '/api/docs'
  });
});

module.exports = router;