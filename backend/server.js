/**
 * Marketing Machine - Main Server
 * Automated LinkedIn content creation from meeting recordings
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Internal imports
const logger = require('./src/utils/logger');
const { connectDatabase } = require('./src/config/database');
const { connectRedis } = require('./src/config/redis');
const { initializeQueue } = require('./src/config/queue');
const routes = require('./src/routes');
const { errorHandler } = require('./src/middleware/errorHandler');
const { startWebhookServer } = require('./src/services/webhook/webhookServer');

// Initialize Express app
const app = express();

// =============================================
// MIDDLEWARE SETUP
// =============================================

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] // Update with your production domain
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) }
  }));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// =============================================
// ROUTES
// =============================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: 'connected', // Will be updated by health checks
      redis: 'connected',
      queue: 'running'
    }
  });
});

// API routes
app.use('/api', routes);

// Catch-all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'GET /health',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/companies',
      'POST /api/content/manual',
      'POST /api/webhooks/receive'
    ]
  });
});

// Global error handler
app.use(errorHandler);

// =============================================
// SERVER STARTUP
// =============================================

async function startServer() {
  try {
    logger.info('🚀 Starting Marketing Machine Server...');

    // Connect to database
    logger.info('📊 Connecting to PostgreSQL...');
    await connectDatabase();
    logger.info('✅ Database connected successfully');

    // Connect to Redis
    logger.info('🔴 Connecting to Redis...');
    await connectRedis();
    logger.info('✅ Redis connected successfully');

    // Initialize job queue
    logger.info('📋 Initializing job queue...');
    await initializeQueue();
    logger.info('✅ Job queue initialized');

    // Start main API server
    const PORT = process.env.PORT || 3001;
    const server = app.listen(PORT, () => {
      logger.info(`🎯 Marketing Machine API Server running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      
      if (process.env.NODE_ENV === 'development') {
        logger.info(`🔧 Development mode - API docs available`);
        logger.info(`🌐 Frontend should connect to: http://localhost:${PORT}`);
      }
    });

    // Start webhook server on separate port
    const WEBHOOK_PORT = process.env.WEBHOOK_PORT || 3002;
    startWebhookServer(WEBHOOK_PORT);

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      logger.info(`📯 Received ${signal}. Starting graceful shutdown...`);
      
      server.close(() => {
        logger.info('🔒 HTTP server closed');
        
        // Close database connections, Redis, etc.
        process.exit(0);
      });

      // Force close after 10 seconds
      setTimeout(() => {
        logger.error('❌ Forceful shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      logger.error('💥 Uncaught Exception:', err);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

  } catch (error) {
    logger.error('💥 Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;