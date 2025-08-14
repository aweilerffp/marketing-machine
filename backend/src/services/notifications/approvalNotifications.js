/**
 * Marketing Machine - Approval Notifications
 * Phase 6: In-App Approval Workflow - Notification System
 */

const logger = require('../../utils/logger');
const { query } = require('../../config/database');
const { cache } = require('../../config/redis');

class ApprovalNotificationService {
  constructor() {
    this.subscribers = new Map(); // WebSocket connections
    this.notificationQueue = [];
  }

  /**
   * Subscribe to approval notifications
   * @param {string} userId - User ID
   * @param {object} connection - WebSocket connection or similar
   */
  subscribe(userId, connection) {
    if (!this.subscribers.has(userId)) {
      this.subscribers.set(userId, new Set());
    }
    this.subscribers.get(userId).add(connection);
    
    logger.info(`User ${userId} subscribed to approval notifications`);
    
    // Send pending notifications on connect
    this.sendPendingNotifications(userId, connection);
  }

  /**
   * Unsubscribe from notifications
   * @param {string} userId - User ID
   * @param {object} connection - WebSocket connection
   */
  unsubscribe(userId, connection) {
    if (this.subscribers.has(userId)) {
      this.subscribers.get(userId).delete(connection);
      
      if (this.subscribers.get(userId).size === 0) {
        this.subscribers.delete(userId);
      }
    }
    
    logger.info(`User ${userId} unsubscribed from approval notifications`);
  }

  /**
   * Send notification to specific user
   * @param {string} userId - Target user ID
   * @param {object} notification - Notification data
   */
  async sendToUser(userId, notification) {
    const userConnections = this.subscribers.get(userId);
    
    if (!userConnections || userConnections.size === 0) {
      // Store notification for later delivery
      await this.storeNotification(userId, notification);
      return;
    }

    const notificationData = {
      ...notification,
      id: this.generateNotificationId(),
      timestamp: new Date().toISOString(),
      delivered: true
    };

    // Send to all user connections
    userConnections.forEach(connection => {
      try {
        if (connection.readyState === 1) { // WebSocket OPEN
          connection.send(JSON.stringify({
            type: 'approval_notification',
            data: notificationData
          }));
        }
      } catch (error) {
        logger.error(`Failed to send notification to user ${userId}:`, error);
      }
    });

    // Log successful delivery
    await this.logNotification(userId, notificationData);
  }

  /**
   * Send notification to all company users
   * @param {string} companyId - Company ID
   * @param {object} notification - Notification data
   * @param {array} excludeUsers - User IDs to exclude
   */
  async sendToCompany(companyId, notification, excludeUsers = []) {
    try {
      // Get all users in company with approval permissions
      const usersResult = await query(`
        SELECT u.id, u.name, u.email, u.role
        FROM users u 
        JOIN company_users cu ON u.id = cu.user_id
        WHERE cu.company_id = $1 
          AND u.role IN ('admin', 'manager', 'approver')
          AND u.id NOT IN (${excludeUsers.map((_, i) => `$${i + 2}`).join(',') || 'NULL'})
          AND u.active = true
      `, [companyId, ...excludeUsers]);

      const users = usersResult.rows;

      // Send to each user
      await Promise.all(
        users.map(user => this.sendToUser(user.id, {
          ...notification,
          recipientName: user.name,
          recipientRole: user.role
        }))
      );

      logger.info(`Sent approval notification to ${users.length} users in company ${companyId}`);
      
    } catch (error) {
      logger.error(`Failed to send company notification:`, error);
    }
  }

  /**
   * Notify when new post needs approval
   * @param {object} post - Post data
   * @param {object} company - Company data
   * @param {object} creator - User who created the post
   */
  async notifyNewPostPendingApproval(post, company, creator) {
    const notification = {
      type: 'new_post_pending_approval',
      title: 'New Post Ready for Review',
      message: `${creator.name} submitted a new LinkedIn post for approval`,
      data: {
        postId: post.id,
        postUuid: post.uuid,
        contentPreview: post.post_content.substring(0, 100) + '...',
        contentType: post.content_type,
        performanceScore: post.performance_score,
        createdBy: creator.name,
        createdAt: post.created_at,
        companyName: company.name
      },
      priority: 'normal',
      actions: [
        { type: 'approve', label: 'Quick Approve' },
        { type: 'review', label: 'Review Details' },
        { type: 'reject', label: 'Reject' }
      ]
    };

    await this.sendToCompany(company.id, notification, [creator.id]);
  }

  /**
   * Notify when post is approved
   * @param {object} post - Post data
   * @param {object} approver - User who approved
   * @param {object} creator - Original post creator
   */
  async notifyPostApproved(post, approver, creator) {
    const notification = {
      type: 'post_approved',
      title: 'Post Approved! ✅',
      message: `Your LinkedIn post has been approved by ${approver.name}`,
      data: {
        postId: post.id,
        postUuid: post.uuid,
        contentPreview: post.post_content.substring(0, 100) + '...',
        approvedBy: approver.name,
        approvedAt: new Date().toISOString(),
        scheduledFor: post.scheduled_for,
        autoPublish: post.status === 'approved_auto_publish'
      },
      priority: 'normal',
      actions: [
        { type: 'view', label: 'View Post' }
      ]
    };

    await this.sendToUser(creator.id, notification);
  }

  /**
   * Notify when post is rejected
   * @param {object} post - Post data
   * @param {object} rejector - User who rejected
   * @param {object} creator - Original post creator
   * @param {string} notes - Rejection notes
   * @param {boolean} regenerate - Whether regeneration was requested
   */
  async notifyPostRejected(post, rejector, creator, notes, regenerate = false) {
    const notification = {
      type: 'post_rejected',
      title: regenerate ? 'Post Rejected - Regenerating ⚡' : 'Post Rejected ❌',
      message: regenerate 
        ? `${rejector.name} rejected your post and requested regeneration`
        : `Your LinkedIn post was rejected by ${rejector.name}`,
      data: {
        postId: post.id,
        postUuid: post.uuid,
        contentPreview: post.post_content.substring(0, 100) + '...',
        rejectedBy: rejector.name,
        rejectedAt: new Date().toISOString(),
        notes: notes,
        regenerate: regenerate
      },
      priority: 'high',
      actions: regenerate 
        ? [{ type: 'view', label: 'View Progress' }]
        : [
            { type: 'edit', label: 'Edit & Resubmit' },
            { type: 'regenerate', label: 'Generate New Version' }
          ]
    };

    await this.sendToUser(creator.id, notification);
  }

  /**
   * Notify about approval deadline approaching
   * @param {object} post - Post data
   * @param {object} company - Company data
   * @param {number} hoursRemaining - Hours until deadline
   */
  async notifyApprovalDeadline(post, company, hoursRemaining) {
    const notification = {
      type: 'approval_deadline_warning',
      title: `⏰ Approval Deadline in ${hoursRemaining}h`,
      message: `Post needs approval within ${hoursRemaining} hours`,
      data: {
        postId: post.id,
        postUuid: post.uuid,
        contentPreview: post.post_content.substring(0, 100) + '...',
        hoursRemaining: hoursRemaining,
        createdAt: post.created_at,
        scheduledFor: post.scheduled_for
      },
      priority: 'high',
      actions: [
        { type: 'approve', label: 'Quick Approve' },
        { type: 'review', label: 'Review Now' }
      ]
    };

    await this.sendToCompany(company.id, notification);
  }

  /**
   * Send daily approval summary
   * @param {string} companyId - Company ID
   */
  async sendDailyApprovalSummary(companyId) {
    try {
      // Get approval stats for today
      const statsResult = await query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'pending_approval') as pending,
          COUNT(*) FILTER (WHERE status = 'approved' AND approved_at::date = CURRENT_DATE) as approved_today,
          COUNT(*) FILTER (WHERE status = 'rejected' AND rejected_at::date = CURRENT_DATE) as rejected_today,
          AVG(performance_score) FILTER (WHERE approved_at::date = CURRENT_DATE) as avg_score_today
        FROM linkedin_posts 
        WHERE company_id = $1
      `, [companyId]);

      const stats = statsResult.rows[0];

      if (parseInt(stats.pending) === 0 && parseInt(stats.approved_today) === 0) {
        return; // No activity to report
      }

      const notification = {
        type: 'daily_approval_summary',
        title: '📊 Daily Approval Summary',
        message: `${stats.pending} pending • ${stats.approved_today} approved today`,
        data: {
          pending: parseInt(stats.pending),
          approvedToday: parseInt(stats.approved_today),
          rejectedToday: parseInt(stats.rejected_today),
          averageScore: parseFloat(stats.avg_score_today) || 0,
          date: new Date().toISOString().split('T')[0]
        },
        priority: 'low',
        actions: [
          { type: 'review_pending', label: 'Review Pending Posts' }
        ]
      };

      await this.sendToCompany(companyId, notification);
      
    } catch (error) {
      logger.error(`Failed to send daily summary for company ${companyId}:`, error);
    }
  }

  /**
   * Store notification for offline delivery
   * @param {string} userId - User ID
   * @param {object} notification - Notification data
   */
  async storeNotification(userId, notification) {
    const notificationData = {
      ...notification,
      id: this.generateNotificationId(),
      timestamp: new Date().toISOString(),
      delivered: false
    };

    try {
      // Store in Redis with 7-day expiry
      const key = `notifications:user:${userId}`;
      await cache.lpush(key, JSON.stringify(notificationData));
      await cache.expire(key, 7 * 24 * 60 * 60); // 7 days
      
      // Keep only latest 100 notifications per user
      await cache.ltrim(key, 0, 99);
      
    } catch (error) {
      logger.error(`Failed to store notification for user ${userId}:`, error);
    }
  }

  /**
   * Get pending notifications for user
   * @param {string} userId - User ID
   * @param {number} limit - Max notifications to return
   */
  async getPendingNotifications(userId, limit = 50) {
    try {
      const key = `notifications:user:${userId}`;
      const notifications = await cache.lrange(key, 0, limit - 1);
      
      return notifications.map(n => JSON.parse(n)).filter(n => !n.delivered);
      
    } catch (error) {
      logger.error(`Failed to get notifications for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Mark notifications as delivered
   * @param {string} userId - User ID
   * @param {array} notificationIds - Notification IDs to mark as delivered
   */
  async markAsDelivered(userId, notificationIds) {
    try {
      const key = `notifications:user:${userId}`;
      const notifications = await cache.lrange(key, 0, -1);
      
      const updated = notifications.map(n => {
        const parsed = JSON.parse(n);
        if (notificationIds.includes(parsed.id)) {
          parsed.delivered = true;
        }
        return JSON.stringify(parsed);
      });
      
      // Replace the list
      if (updated.length > 0) {
        await cache.del(key);
        await cache.lpush(key, ...updated);
        await cache.expire(key, 7 * 24 * 60 * 60);
      }
      
    } catch (error) {
      logger.error(`Failed to mark notifications as delivered:`, error);
    }
  }

  /**
   * Send pending notifications to user connection
   * @param {string} userId - User ID
   * @param {object} connection - WebSocket connection
   */
  async sendPendingNotifications(userId, connection) {
    try {
      const notifications = await this.getPendingNotifications(userId, 10);
      
      if (notifications.length > 0) {
        connection.send(JSON.stringify({
          type: 'pending_notifications',
          data: notifications
        }));
        
        // Mark as delivered
        const notificationIds = notifications.map(n => n.id);
        await this.markAsDelivered(userId, notificationIds);
      }
      
    } catch (error) {
      logger.error(`Failed to send pending notifications:`, error);
    }
  }

  /**
   * Log notification delivery
   * @param {string} userId - User ID
   * @param {object} notification - Notification data
   */
  async logNotification(userId, notification) {
    try {
      await query(`
        INSERT INTO notification_logs 
        (user_id, type, title, message, data, delivered_at, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      `, [
        userId,
        notification.type,
        notification.title,
        notification.message,
        notification.data
      ]);
    } catch (error) {
      logger.error('Failed to log notification:', error);
    }
  }

  /**
   * Generate unique notification ID
   * @returns {string} Unique notification ID
   */
  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Schedule recurring approval deadline checks
   */
  startDeadlineMonitoring() {
    // Check every hour for approaching deadlines
    setInterval(async () => {
      try {
        await this.checkApprovalDeadlines();
      } catch (error) {
        logger.error('Error in deadline monitoring:', error);
      }
    }, 60 * 60 * 1000); // Every hour

    logger.info('Approval deadline monitoring started');
  }

  /**
   * Check for approaching approval deadlines
   */
  async checkApprovalDeadlines() {
    try {
      const postsResult = await query(`
        SELECT 
          p.id, p.uuid, p.post_content, p.created_at, p.scheduled_for,
          c.id as company_id, c.name as company_name,
          EXTRACT(EPOCH FROM (p.scheduled_for - NOW()))/3600 as hours_remaining
        FROM linkedin_posts p
        JOIN companies c ON p.company_id = c.id
        WHERE p.status = 'pending_approval'
          AND p.scheduled_for IS NOT NULL
          AND p.scheduled_for > NOW()
          AND EXTRACT(EPOCH FROM (p.scheduled_for - NOW()))/3600 BETWEEN 1 AND 24
      `);

      for (const post of postsResult.rows) {
        const hoursRemaining = Math.floor(post.hours_remaining);
        
        // Send warning at 24h, 4h, and 1h before deadline
        if ([24, 4, 1].includes(hoursRemaining)) {
          await this.notifyApprovalDeadline(
            post,
            { id: post.company_id, name: post.company_name },
            hoursRemaining
          );
        }
      }

    } catch (error) {
      logger.error('Error checking approval deadlines:', error);
    }
  }

  /**
   * Schedule daily approval summaries
   */
  startDailySummaries() {
    // Send at 9 AM every day
    const scheduleDaily = () => {
      const now = new Date();
      const scheduledTime = new Date(now);
      scheduledTime.setHours(9, 0, 0, 0);
      
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }
      
      const timeUntilNext = scheduledTime.getTime() - now.getTime();
      
      setTimeout(async () => {
        await this.sendDailySummariesToAllCompanies();
        
        // Schedule next day
        setInterval(
          () => this.sendDailySummariesToAllCompanies(),
          24 * 60 * 60 * 1000 // Every 24 hours
        );
      }, timeUntilNext);
    };

    scheduleDaily();
    logger.info('Daily approval summaries scheduled');
  }

  /**
   * Send daily summaries to all active companies
   */
  async sendDailySummariesToAllCompanies() {
    try {
      const companiesResult = await query(`
        SELECT DISTINCT c.id 
        FROM companies c 
        JOIN linkedin_posts p ON c.id = p.company_id 
        WHERE c.active = true 
          AND p.created_at >= NOW() - INTERVAL '7 days'
      `);

      for (const company of companiesResult.rows) {
        await this.sendDailyApprovalSummary(company.id);
      }

      logger.info(`Sent daily summaries to ${companiesResult.rows.length} companies`);
      
    } catch (error) {
      logger.error('Error sending daily summaries:', error);
    }
  }

  /**
   * Initialize the notification service
   */
  initialize() {
    this.startDeadlineMonitoring();
    this.startDailySummaries();
    
    logger.info('Approval notification service initialized');
  }
}

module.exports = new ApprovalNotificationService();