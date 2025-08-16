/**
 * Marketing Machine - Clerk Authentication Middleware
 * Validates Clerk JWT tokens and creates user sessions
 */

const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { UnauthorizedError, ForbiddenError } = require('./errorHandler');

/**
 * Verify Clerk JWT token and get/create user in database
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next function
 */
async function authenticateClerkToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw new UnauthorizedError('Access token required');
    }

    // For now, we'll decode the Clerk JWT without verification
    // In production, you'd verify against Clerk's public keys
    let decoded;
    try {
      // Decode without verification for development
      decoded = jwt.decode(token);
      
      if (!decoded || !decoded.sub) {
        throw new UnauthorizedError('Invalid token format');
      }
    } catch (error) {
      logger.warn('Failed to decode Clerk token', { 
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      throw new UnauthorizedError('Invalid access token');
    }

    const clerkUserId = decoded.sub;
    const userEmail = decoded.email || `user-${clerkUserId}@clerk.generated`;

    logger.debug('Clerk token decoded', {
      clerkUserId,
      email: userEmail,
      iat: decoded.iat,
      exp: decoded.exp
    });

    // Check if user exists in our database
    let userResult = await query(
      `SELECT u.*, c.name as company_name, c.status as company_status, c.subscription_tier
       FROM users u
       LEFT JOIN companies c ON u.company_id = c.id  
       WHERE u.email = $1 AND u.status = 'active'`,
      [userEmail]
    );

    let user;
    if (userResult.rows.length === 0) {
      // User doesn't exist, create them with default company
      logger.info('Creating new user from Clerk authentication', {
        clerkUserId,
        email: userEmail
      });

      // Get or create default company for new users
      let companyResult = await query(
        `SELECT id FROM companies WHERE name = 'Marketing Machine Demo' LIMIT 1`
      );

      let companyId = 1; // Default to demo company
      if (companyResult.rows.length > 0) {
        companyId = companyResult.rows[0].id;
      }

      // Create new user
      const newUserResult = await query(
        `INSERT INTO users (email, first_name, last_name, company_id, role, status, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          userEmail,
          decoded.given_name || 'User',
          decoded.family_name || '',
          companyId,
          'user',
          'active',
          true
        ]
      );

      // Fetch the complete user record
      userResult = await query(
        `SELECT u.*, c.name as company_name, c.status as company_status, c.subscription_tier
         FROM users u
         LEFT JOIN companies c ON u.company_id = c.id  
         WHERE u.id = $1`,
        [newUserResult.rows[0].id]
      );

      user = userResult.rows[0];
      logger.info('New user created successfully', {
        userId: user.id,
        email: user.email,
        companyId: user.company_id
      });
    } else {
      user = userResult.rows[0];
      logger.debug('Existing user found', {
        userId: user.id,
        email: user.email,
        companyId: user.company_id
      });
    }

    // Check if company is active (if user has one)
    if (user.company_id && user.company_status !== 'active') {
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
      subscriptionTier: user.subscription_tier || 'free',
      permissions: user.permissions || {},
      clerkUserId: clerkUserId
    };

    logger.debug('User authenticated successfully via Clerk', {
      userId: user.id,
      email: user.email,
      companyId: user.company_id,
      role: user.role,
      clerkUserId
    });

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      return next(error);
    }

    logger.error('Clerk authentication error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    next(new UnauthorizedError('Authentication failed'));
  }
}

/**
 * Optional Clerk authentication (doesn't fail if no token)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function optionalClerkAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next(); // No token, continue without user info
  }

  try {
    await authenticateClerkToken(req, res, next);
  } catch (error) {
    // If authentication fails, continue without user info
    logger.debug('Optional Clerk auth failed, continuing without user', {
      error: error.message
    });
    next();
  }
}

module.exports = {
  authenticateClerkToken,
  optionalClerkAuth
};