/**
 * Marketing Machine - Global Error Handler
 * Centralized error handling middleware
 */

const logger = require('../utils/logger').createComponentLogger('error-handler');

/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function errorHandler(err, req, res, next) {
  // Log the error
  logger.error('Request error', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
    companyId: req.user?.company_id
  });

  // Default error response
  let status = 500;
  let message = 'Internal server error';
  let code = 'INTERNAL_ERROR';
  let details = null;

  // Handle different error types
  if (err.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    details = err.details || err.message;
  } else if (err.name === 'UnauthorizedError' || err.message.includes('jwt')) {
    status = 401;
    message = 'Authentication required';
    code = 'UNAUTHORIZED';
  } else if (err.name === 'ForbiddenError') {
    status = 403;
    message = 'Access forbidden';
    code = 'FORBIDDEN';
  } else if (err.name === 'NotFoundError') {
    status = 404;
    message = 'Resource not found';
    code = 'NOT_FOUND';
  } else if (err.name === 'ConflictError') {
    status = 409;
    message = 'Resource conflict';
    code = 'CONFLICT';
    details = err.message;
  } else if (err.name === 'RateLimitError') {
    status = 429;
    message = 'Too many requests';
    code = 'RATE_LIMIT_EXCEEDED';
    details = err.message;
  } else if (err.code === '23505') { // PostgreSQL unique constraint error
    status = 409;
    message = 'Resource already exists';
    code = 'DUPLICATE_RESOURCE';
    details = 'A resource with this identifier already exists';
  } else if (err.code === '23503') { // PostgreSQL foreign key constraint error
    status = 400;
    message = 'Invalid reference';
    code = 'INVALID_REFERENCE';
    details = 'Referenced resource does not exist';
  } else if (err.code === '23502') { // PostgreSQL not null constraint error
    status = 400;
    message = 'Missing required field';
    code = 'REQUIRED_FIELD_MISSING';
  } else if (err.code === 'ECONNREFUSED') {
    status = 503;
    message = 'Service temporarily unavailable';
    code = 'SERVICE_UNAVAILABLE';
    details = 'External service connection failed';
  } else if (err.status) {
    // If error already has a status, use it
    status = err.status;
    message = err.message;
    code = err.code || 'CLIENT_ERROR';
    details = err.details;
  }

  // Prepare error response
  const errorResponse = {
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      requestId: req.id || generateRequestId()
    }
  };

  // Add details in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.details = details || err.message;
    errorResponse.error.stack = err.stack;
  } else if (details && status < 500) {
    // Only show details for client errors (4xx) in production
    errorResponse.error.details = details;
  }

  // Send error response
  res.status(status).json(errorResponse);
}

/**
 * 404 Not Found handler
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function notFoundHandler(req, res) {
  logger.warn('Route not found', {
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
      timestamp: new Date().toISOString(),
      path: req.url,
      method: req.method
    }
  });
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch and forward errors
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create custom error classes
 */
class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

class UnauthorizedError extends Error {
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends Error {
  constructor(message = 'Access forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

class NotFoundError extends Error {
  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends Error {
  constructor(message = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

class RateLimitError extends Error {
  constructor(message = 'Too many requests') {
    super(message);
    this.name = 'RateLimitError';
  }
}

class ServiceError extends Error {
  constructor(message, code = 'SERVICE_ERROR', status = 500) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Generate a unique request ID
 * @returns {string} Request ID
 */
function generateRequestId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Express error boundary for catching unhandled errors
 * @param {Function} handler - Route handler function
 * @returns {Function} Wrapped handler
 */
function errorBoundary(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  errorBoundary,
  
  // Custom error classes
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceError
};