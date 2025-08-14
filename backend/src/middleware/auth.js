/**
 * Marketing Machine - Authentication Middleware
 * JWT authentication and authorization
 */

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../utils/logger').auth;
const { UnauthorizedError, ForbiddenError } = require('./errorHandler');

/**
 * Authenticate JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next function
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw new UnauthorizedError('Access token required');
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user details from database
    const userResult = await query(
      `SELECT u.*, c.name as company_name, c.status as company_status, c.subscription_tier
       FROM users u
       JOIN companies c ON u.company_id = c.id  
       WHERE u.id = $1 AND u.status = 'active'`,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      throw new UnauthorizedError('User not found or inactive');
    }

    const user = userResult.rows[0];

    // Check if company is active
    if (user.company_status !== 'active') {
      throw new ForbiddenError('Company account is inactive');
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      companyId: user.company_id,
      companyName: user.company_name,
      subscriptionTier: user.subscription_tier,
      permissions: user.permissions || {}
    };

    logger.debug('User authenticated successfully', {
      userId: user.id,
      email: user.email,
      companyId: user.company_id,
      role: user.role
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid JWT token', { 
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return next(new UnauthorizedError('Invalid access token'));
    }
    
    if (error.name === 'TokenExpiredError') {
      logger.warn('Expired JWT token', { 
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      return next(new UnauthorizedError('Access token expired'));
    }

    logger.error('Authentication error', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    next(error);
  }
}

/**
 * Optional authentication (doesn't fail if no token)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(); // No token, continue without user info
  }

  try {
    await authenticateToken(req, res, next);
  } catch (error) {
    // If authentication fails, continue without user info
    logger.debug('Optional auth failed, continuing without user', {
      error: error.message
    });
    next();
  }
}

/**
 * Require specific role
 * @param {string|Array} requiredRoles - Required role(s)
 * @returns {Function} Middleware function
 */
function requireRole(requiredRoles) {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Access denied - insufficient role', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        endpoint: req.originalUrl
      });
      return next(new ForbiddenError('Insufficient permissions'));
    }

    logger.debug('Role check passed', {
      userId: req.user.id,
      userRole: req.user.role,
      requiredRoles: roles
    });

    next();
  };
}

/**
 * Require specific permission
 * @param {string} permission - Required permission
 * @returns {Function} Middleware function
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userPermissions = req.user.permissions || {};
    
    if (!userPermissions[permission]) {
      logger.warn('Access denied - missing permission', {
        userId: req.user.id,
        requiredPermission: permission,
        userPermissions: Object.keys(userPermissions),
        endpoint: req.originalUrl
      });
      return next(new ForbiddenError(`Missing permission: ${permission}`));
    }

    logger.debug('Permission check passed', {
      userId: req.user.id,
      permission,
      endpoint: req.originalUrl
    });

    next();
  };
}

/**
 * Require subscription tier
 * @param {string} minimumTier - Minimum required subscription tier
 * @returns {Function} Middleware function
 */
function requireSubscription(minimumTier) {
  const tierLevels = {
    'free': 0,
    'basic': 1,
    'pro': 2,
    'enterprise': 3
  };

  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }

    const userTierLevel = tierLevels[req.user.subscriptionTier] || 0;
    const requiredTierLevel = tierLevels[minimumTier] || 0;

    if (userTierLevel < requiredTierLevel) {
      logger.warn('Access denied - insufficient subscription', {
        userId: req.user.id,
        userTier: req.user.subscriptionTier,
        requiredTier: minimumTier,
        endpoint: req.originalUrl
      });
      return next(new ForbiddenError(`Requires ${minimumTier} subscription or higher`));
    }

    logger.debug('Subscription check passed', {
      userId: req.user.id,
      userTier: req.user.subscriptionTier,
      requiredTier: minimumTier
    });

    next();
  };
}

/**
 * Rate limiting by user
 * @param {Object} options - Rate limiting options
 * @returns {Function} Middleware function
 */
function rateLimitByUser(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    skipSuccessfulRequests = false
  } = options;

  return async (req, res, next) => {
    if (!req.user) {
      return next(); // No user, skip rate limiting
    }

    try {
      const { rateLimit } = require('../config/redis');
      const identifier = `user:${req.user.id}`;
      
      const rateLimitInfo = await rateLimit.increment(identifier, windowMs, maxRequests);
      
      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': rateLimitInfo.remaining,
        'X-RateLimit-Reset': rateLimitInfo.resetTime.toISOString()
      });

      if (rateLimitInfo.exceeded) {
        logger.warn('Rate limit exceeded', {
          userId: req.user.id,
          current: rateLimitInfo.current,
          limit: maxRequests,
          resetTime: rateLimitInfo.resetTime,
          endpoint: req.originalUrl
        });
        
        return res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            retryAfter: rateLimitInfo.resetTime
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Rate limit check failed', {
        userId: req.user.id,
        error: error.message
      });
      // Continue on rate limit error (fail open)
      next();
    }
  };
}

/**
 * Generate JWT token
 * @param {Object} payload - Token payload
 * @param {Object} options - Token options
 * @returns {string} JWT token
 */
function generateToken(payload, options = {}) {
  const {
    expiresIn = process.env.JWT_EXPIRES_IN || '24h',
    secret = process.env.JWT_SECRET
  } = options;

  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Generate refresh token
 * @param {Object} payload - Token payload
 * @returns {string} Refresh token
 */
function generateRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  });
}

/**
 * Verify refresh token
 * @param {string} token - Refresh token
 * @returns {Object} Decoded token
 */
function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRole,
  requirePermission,
  requireSubscription,
  rateLimitByUser,
  generateToken,
  generateRefreshToken,
  verifyRefreshToken
};