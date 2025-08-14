/**
 * Marketing Machine - Publishing System Tests
 * Phase 7: Smart Publishing System Tests
 */

const request = require('supertest');
const express = require('express');
const PublishingService = require('../src/services/publishing/publishingService');
const SmartScheduler = require('../src/services/publishing/smartScheduler');
const LinkedInAPI = require('../src/services/publishing/linkedinAPI');

// Create test app
const app = express();
app.use(express.json());

// Mock authentication middleware
const mockUser = {
  id: 1,
  companyId: 1,
  userId: 1,
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin'
};

app.use((req, res, next) => {
  req.user = mockUser;
  next();
});

// Import and use publishing routes
const publishingRoutes = require('../src/routes/publishing');
app.use('/api/publishing', publishingRoutes);

// Mock database
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn()
}));

// Mock queue
jest.mock('../src/config/queue', () => ({
  publishingQueue: {
    add: jest.fn().mockResolvedValue({ id: 'job-123' })
  }
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('Publishing System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PublishingService', () => {
    let publishingService;

    beforeEach(() => {
      publishingService = new PublishingService();
    });

    describe('schedulePost', () => {
      it('should schedule a post with smart scheduling', async () => {
        const { query, transaction } = require('../src/config/database');
        
        const mockTransaction = (callback) => {
          const mockClient = {
            query: jest.fn()
              .mockResolvedValueOnce({ 
                rows: [{ 
                  id: 1, 
                  status: 'approved',
                  post_content: 'Test content',
                  linkedin_access_token: 'test-token',
                  company_name: 'Test Company'
                }] 
              })
              .mockResolvedValueOnce({ rows: [] })
              .mockResolvedValueOnce({ rows: [] })
              .mockResolvedValueOnce({ rows: [] })
          };
          return callback(mockClient);
        };

        transaction.mockImplementation(mockTransaction);

        const result = await publishingService.schedulePost(1, 1, 1, {
          useSmartScheduling: true
        });

        expect(result).toHaveProperty('postId', 1);
        expect(result).toHaveProperty('scheduledFor');
        expect(result).toHaveProperty('message');
      });

      it('should schedule a post with manual time', async () => {
        const { transaction } = require('../src/config/database');
        
        const scheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
        
        const mockTransaction = (callback) => {
          const mockClient = {
            query: jest.fn()
              .mockResolvedValueOnce({ 
                rows: [{ 
                  id: 1, 
                  status: 'approved',
                  post_content: 'Test content',
                  linkedin_access_token: 'test-token',
                  company_name: 'Test Company'
                }] 
              })
              .mockResolvedValueOnce({ rows: [] })
              .mockResolvedValueOnce({ rows: [] })
          };
          return callback(mockClient);
        };

        transaction.mockImplementation(mockTransaction);

        const result = await publishingService.schedulePost(1, 1, 1, {
          scheduledFor: scheduledTime.toISOString(),
          useSmartScheduling: false
        });

        expect(result).toHaveProperty('postId', 1);
        expect(new Date(result.scheduledFor)).toEqual(scheduledTime);
      });

      it('should throw error for non-approved post', async () => {
        const { transaction } = require('../src/config/database');
        
        const mockTransaction = (callback) => {
          const mockClient = {
            query: jest.fn()
              .mockResolvedValueOnce({ 
                rows: [{ 
                  id: 1, 
                  status: 'pending_approval'
                }] 
              })
          };
          return callback(mockClient);
        };

        transaction.mockImplementation(mockTransaction);

        await expect(publishingService.schedulePost(1, 1, 1))
          .rejects.toThrow('Post must be approved before scheduling');
      });
    });

    describe('publishToLinkedIn', () => {
      it('should publish text post to LinkedIn', async () => {
        const { query } = require('../src/config/database');
        const { transaction } = require('../src/config/database');

        // Mock LinkedInAPI
        const mockPublishResult = {
          id: 'linkedin-post-123',
          url: 'https://linkedin.com/feed/update/linkedin-post-123',
          publishedAt: new Date().toISOString()
        };

        // Mock transaction
        const mockTransaction = (callback) => {
          const mockClient = {
            query: jest.fn()
              .mockResolvedValueOnce({ rows: [] })
              .mockResolvedValueOnce({ rows: [] })
          };
          return callback(mockClient);
        };

        transaction.mockImplementation(mockTransaction);

        // Mock LinkedInAPI methods
        LinkedInAPI.prototype.validateToken = jest.fn().mockResolvedValue(true);
        LinkedInAPI.prototype.publishTextPost = jest.fn().mockResolvedValue(mockPublishResult);

        const jobData = {
          postId: 1,
          companyId: 1,
          userId: 1,
          postContent: 'Test LinkedIn post content',
          hashtags: ['#Test', '#Marketing'],
          linkedInToken: 'test-token',
          companyName: 'Test Company'
        };

        const result = await publishingService.publishToLinkedIn(jobData);

        expect(result.success).toBe(true);
        expect(result.linkedInPostId).toBe('linkedin-post-123');
        expect(LinkedInAPI.prototype.validateToken).toHaveBeenCalled();
        expect(LinkedInAPI.prototype.publishTextPost).toHaveBeenCalledWith(
          'Test LinkedIn post content\n\n#Test #Marketing',
          'PUBLIC'
        );
      });

      it('should publish image post to LinkedIn', async () => {
        const { transaction } = require('../src/config/database');

        // Mock LinkedInAPI
        const mockPublishResult = {
          id: 'linkedin-post-124',
          url: 'https://linkedin.com/feed/update/linkedin-post-124',
          publishedAt: new Date().toISOString(),
          imageUrn: 'urn:li:image:123'
        };

        const mockTransaction = (callback) => {
          const mockClient = {
            query: jest.fn()
              .mockResolvedValueOnce({ rows: [] })
              .mockResolvedValueOnce({ rows: [] })
          };
          return callback(mockClient);
        };

        transaction.mockImplementation(mockTransaction);

        LinkedInAPI.prototype.validateToken = jest.fn().mockResolvedValue(true);
        LinkedInAPI.prototype.publishImagePost = jest.fn().mockResolvedValue(mockPublishResult);

        const jobData = {
          postId: 1,
          companyId: 1,
          userId: 1,
          postContent: 'Test post with image',
          imageData: {
            id: 1,
            url: 'https://example.com/image.png'
          },
          linkedInToken: 'test-token'
        };

        const result = await publishingService.publishToLinkedIn(jobData);

        expect(result.success).toBe(true);
        expect(result.linkedInPostId).toBe('linkedin-post-124');
        expect(LinkedInAPI.prototype.publishImagePost).toHaveBeenCalledWith(
          'Test post with image',
          'https://example.com/image.png',
          'PUBLIC'
        );
      });

      it('should handle invalid LinkedIn token', async () => {
        LinkedInAPI.prototype.validateToken = jest.fn().mockResolvedValue(false);

        const jobData = {
          postId: 1,
          companyId: 1,
          userId: 1,
          postContent: 'Test content',
          linkedInToken: 'invalid-token'
        };

        await expect(publishingService.publishToLinkedIn(jobData))
          .rejects.toThrow('LinkedIn access token is invalid or expired');
      });
    });

    describe('cancelScheduledPost', () => {
      it('should cancel a scheduled post', async () => {
        const { transaction } = require('../src/config/database');

        const mockTransaction = (callback) => {
          const mockClient = {
            query: jest.fn()
              .mockResolvedValueOnce({ 
                rows: [{ 
                  status: 'scheduled', 
                  scheduled_for: new Date().toISOString() 
                }] 
              })
              .mockResolvedValueOnce({ rows: [] })
              .mockResolvedValueOnce({ rows: [] })
          };
          return callback(mockClient);
        };

        transaction.mockImplementation(mockTransaction);

        const result = await publishingService.cancelScheduledPost(1, 1, 1);

        expect(result).toHaveProperty('message');
        expect(result.message).toContain('cancelled successfully');
      });

      it('should throw error for non-scheduled post', async () => {
        const { transaction } = require('../src/config/database');

        const mockTransaction = (callback) => {
          const mockClient = {
            query: jest.fn()
              .mockResolvedValueOnce({ 
                rows: [{ 
                  status: 'published' 
                }] 
              })
          };
          return callback(mockClient);
        };

        transaction.mockImplementation(mockTransaction);

        await expect(publishingService.cancelScheduledPost(1, 1, 1))
          .rejects.toThrow('Only scheduled posts can be cancelled');
      });
    });

    describe('getPublishingStats', () => {
      it('should return publishing statistics', async () => {
        const { query } = require('../src/config/database');

        const mockStats = {
          scheduled: '3',
          published: '15',
          failed: '1',
          recent_published: '10',
          avg_performance: '8.5',
          total_impressions: '1000',
          total_likes: '50',
          total_comments: '10',
          total_shares: '5'
        };

        query.mockResolvedValueOnce({ rows: [mockStats] });

        const stats = await publishingService.getPublishingStats(1, 30);

        expect(stats.scheduled).toBe(3);
        expect(stats.published).toBe(15);
        expect(stats.avg_performance).toBe(8.5);
        expect(stats.period_days).toBe(30);
      });
    });

    describe('getScheduledPosts', () => {
      it('should return scheduled posts', async () => {
        const { query } = require('../src/config/database');

        const mockPosts = [
          {
            id: 1,
            post_content: 'Test post 1',
            scheduled_for: new Date().toISOString(),
            scheduled_by_name: 'Test User',
            selected_images: []
          },
          {
            id: 2,
            post_content: 'Test post 2',
            scheduled_for: new Date().toISOString(),
            scheduled_by_name: 'Test User',
            selected_images: null
          }
        ];

        query.mockResolvedValueOnce({ rows: mockPosts });

        const posts = await publishingService.getScheduledPosts(1, 20);

        expect(posts).toHaveLength(2);
        expect(posts[0].id).toBe(1);
        expect(posts[1].id).toBe(2);
      });
    });
  });

  describe('SmartScheduler', () => {
    let scheduler;

    beforeEach(() => {
      scheduler = new SmartScheduler();
    });

    describe('calculateOptimalTime', () => {
      it('should return preferred time if reasonable', async () => {
        const { query } = require('../src/config/database');

        // Mock database calls
        query
          .mockResolvedValueOnce({ rows: [] }) // performance data
          .mockResolvedValueOnce({ rows: [{ content_type: 'meeting_transcript' }] }); // content data

        const preferredTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow
        
        const result = await scheduler.calculateOptimalTime(1, 1, preferredTime.toISOString());

        expect(result).toEqual(preferredTime);
      });

      it('should calculate optimal time when no preference given', async () => {
        const { query } = require('../src/config/database');

        // Mock performance data
        const mockPerformanceData = [
          {
            day_of_week: '3', // Wednesday
            hour_of_day: '10',
            avg_performance: '9.2',
            post_count: '5'
          }
        ];

        query
          .mockResolvedValueOnce({ rows: mockPerformanceData })
          .mockResolvedValueOnce({ rows: [{ 
            content_type: 'meeting_transcript',
            timezone: 'UTC',
            content_length: 500
          }] })
          .mockResolvedValueOnce({ rows: [{ timezone: 'UTC' }] }); // company timezone

        const result = await scheduler.calculateOptimalTime(1, 1);

        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBeGreaterThan(Date.now());
      });

      it('should fall back to default time on error', async () => {
        const { query } = require('../src/config/database');

        query.mockRejectedValue(new Error('Database error'));

        const result = await scheduler.calculateOptimalTime(1, 1);

        expect(result).toBeInstanceOf(Date);
        expect(result.getTime()).toBeGreaterThan(Date.now());
      });
    });

    describe('isReasonableTime', () => {
      it('should return true for reasonable future time', () => {
        const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // tomorrow
        futureTime.setHours(10, 0, 0, 0); // 10 AM

        expect(scheduler.isReasonableTime(futureTime)).toBe(true);
      });

      it('should return false for past time', () => {
        const pastTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

        expect(scheduler.isReasonableTime(pastTime)).toBe(false);
      });

      it('should return false for time outside business hours', () => {
        const earlyTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
        earlyTime.setHours(4, 0, 0, 0); // 4 AM

        expect(scheduler.isReasonableTime(earlyTime)).toBe(false);
      });

      it('should return false for time too far in future', () => {
        const farFuture = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000); // 35 days

        expect(scheduler.isReasonableTime(farFuture)).toBe(false);
      });
    });
  });

  describe('API Routes', () => {
    describe('POST /api/publishing/schedule', () => {
      it('should schedule a post successfully', async () => {
        const { transaction } = require('../src/config/database');

        const mockTransaction = (callback) => {
          const mockClient = {
            query: jest.fn()
              .mockResolvedValueOnce({ 
                rows: [{ 
                  id: 1, 
                  status: 'approved',
                  post_content: 'Test content',
                  linkedin_access_token: 'test-token',
                  company_name: 'Test Company'
                }] 
              })
              .mockResolvedValueOnce({ rows: [] })
              .mockResolvedValueOnce({ rows: [] })
              .mockResolvedValueOnce({ rows: [] })
          };
          return callback(mockClient);
        };

        transaction.mockImplementation(mockTransaction);

        const response = await request(app)
          .post('/api/publishing/schedule')
          .send({
            postId: 1,
            useSmartScheduling: true
          })
          .expect(200);

        expect(response.body).toHaveProperty('postId');
        expect(response.body).toHaveProperty('scheduledFor');
        expect(response.body).toHaveProperty('message');
      });

      it('should return error for missing postId', async () => {
        const response = await request(app)
          .post('/api/publishing/schedule')
          .send({})
          .expect(400);

        expect(response.body.error).toBe('Post ID is required');
      });
    });

    describe('GET /api/publishing/scheduled', () => {
      it('should return scheduled posts', async () => {
        const { query } = require('../src/config/database');

        const mockPosts = [
          {
            id: 1,
            post_content: 'Scheduled post content',
            scheduled_for: new Date().toISOString()
          }
        ];

        query.mockResolvedValueOnce({ rows: mockPosts });

        const response = await request(app)
          .get('/api/publishing/scheduled')
          .expect(200);

        expect(response.body).toHaveProperty('posts');
        expect(response.body.posts).toHaveLength(1);
        expect(response.body.posts[0].id).toBe(1);
      });
    });

    describe('GET /api/publishing/stats', () => {
      it('should return publishing statistics', async () => {
        const { query } = require('../src/config/database');

        const mockStats = {
          scheduled: '2',
          published: '10',
          failed: '0',
          avg_performance: '8.0'
        };

        query.mockResolvedValueOnce({ rows: [mockStats] });

        const response = await request(app)
          .get('/api/publishing/stats')
          .expect(200);

        expect(response.body.scheduled).toBe(2);
        expect(response.body.published).toBe(10);
        expect(response.body.avg_performance).toBe(8.0);
      });
    });

    describe('DELETE /api/publishing/schedule/:postId', () => {
      it('should cancel scheduled post', async () => {
        const { transaction } = require('../src/config/database');

        const mockTransaction = (callback) => {
          const mockClient = {
            query: jest.fn()
              .mockResolvedValueOnce({ 
                rows: [{ 
                  status: 'scheduled', 
                  scheduled_for: new Date().toISOString() 
                }] 
              })
              .mockResolvedValueOnce({ rows: [] })
              .mockResolvedValueOnce({ rows: [] })
          };
          return callback(mockClient);
        };

        transaction.mockImplementation(mockTransaction);

        const response = await request(app)
          .delete('/api/publishing/schedule/1')
          .expect(200);

        expect(response.body.message).toContain('cancelled successfully');
      });
    });

    describe('POST /api/publishing/publish-now', () => {
      it('should queue post for immediate publishing', async () => {
        const { transaction } = require('../src/config/database');

        const mockTransaction = (callback) => {
          const mockClient = {
            query: jest.fn()
              .mockResolvedValueOnce({ 
                rows: [{ 
                  id: 1, 
                  status: 'approved',
                  post_content: 'Test content',
                  linkedin_access_token: 'test-token',
                  company_name: 'Test Company'
                }] 
              })
              .mockResolvedValueOnce({ rows: [] })
              .mockResolvedValueOnce({ rows: [] })
          };
          return callback(mockClient);
        };

        transaction.mockImplementation(mockTransaction);

        const response = await request(app)
          .post('/api/publishing/publish-now')
          .send({ postId: 1 })
          .expect(200);

        expect(response.body.message).toContain('immediate publishing');
      });
    });

    describe('GET /api/publishing/optimal-time/:postId', () => {
      it('should return optimal publishing time', async () => {
        const { query } = require('../src/config/database');

        query
          .mockResolvedValueOnce({ rows: [] }) // performance data
          .mockResolvedValueOnce({ rows: [{ 
            content_type: 'meeting_transcript',
            timezone: 'UTC'
          }] })
          .mockResolvedValueOnce({ rows: [{ timezone: 'UTC' }] });

        const response = await request(app)
          .get('/api/publishing/optimal-time/1')
          .expect(200);

        expect(response.body).toHaveProperty('optimalTime');
        expect(response.body).toHaveProperty('timezone');
        expect(response.body).toHaveProperty('confidence');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const { query } = require('../src/config/database');

      query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/publishing/stats')
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch publishing stats');
    });

    it('should validate required parameters', async () => {
      const response = await request(app)
        .post('/api/publishing/publish-now')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Post ID is required');
    });
  });
});

describe('LinkedInAPI', () => {
  let linkedInAPI;
  const mockToken = 'test-access-token';
  const mockCompanyId = 1;

  beforeEach(() => {
    linkedInAPI = new LinkedInAPI(mockToken, mockCompanyId);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(linkedInAPI.accessToken).toBe(mockToken);
      expect(linkedInAPI.companyId).toBe(mockCompanyId);
      expect(linkedInAPI.baseURL).toBe('https://api.linkedin.com/v2');
    });
  });

  describe('isReasonableTime', () => {
    it('should be defined on SmartScheduler', () => {
      const scheduler = new SmartScheduler();
      expect(typeof scheduler.isReasonableTime).toBe('function');
    });
  });
});