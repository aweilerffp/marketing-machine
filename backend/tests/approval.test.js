/**
 * Marketing Machine - Approval System Tests
 * Phase 6: In-App Approval Workflow Tests
 */

const request = require('supertest');
const app = require('./test-server');
const { query } = require('../src/config/database');

// Mock authentication
const mockUser = {
  id: 1,
  companyId: 1,
  name: 'Test User',
  email: 'test@example.com',
  role: 'admin'
};

// Mock JWT token
const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

// Mock database queries
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn()
}));

// Mock Redis
jest.mock('../src/config/redis', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn()
  }
}));

// Mock authentication middleware
jest.mock('../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = mockUser;
    next();
  }
}));

describe('Approval System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/approval/pending', () => {
    it('should fetch pending posts for approval', async () => {
      const mockPosts = [
        {
          id: 1,
          uuid: 'test-uuid-1',
          post_content: 'Test LinkedIn post content for approval testing',
          hashtags: ['#Test', '#Marketing'],
          performance_score: 8,
          status: 'pending_approval',
          created_at: new Date().toISOString(),
          source_title: 'Test Meeting',
          content_type: 'meeting_transcript',
          created_by_name: 'John Doe',
          images: [],
          hooks: []
        }
      ];

      const mockCount = { total: '1' };

      query
        .mockResolvedValueOnce({ rows: mockPosts })
        .mockResolvedValueOnce({ rows: [mockCount] });

      const response = await request(app)
        .get('/api/approval/pending')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('posts');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.posts).toHaveLength(1);
      expect(response.body.posts[0].post_content).toBe('Test LinkedIn post content for approval testing');
      expect(response.body.pagination.total).toBe(1);
    });

    it('should filter by content type', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] });

      const response = await request(app)
        .get('/api/approval/pending?content_type=sales_call')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('AND cs.content_type = $3'),
        expect.arrayContaining([1, 'pending_approval', 'sales_call'])
      );
    });

    it('should handle pagination', async () => {
      query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: '0' }] });

      const response = await request(app)
        .get('/api/approval/pending?page=2&limit=10')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.arrayContaining([1, 'pending_approval', 10, 10])
      );
    });
  });

  describe('GET /api/approval/posts/:postId', () => {
    it('should fetch detailed post information', async () => {
      const mockPost = {
        id: 1,
        uuid: 'test-uuid-1',
        post_content: 'Detailed post content for review',
        hashtags: ['#Detail', '#Review'],
        performance_score: 9,
        status: 'pending_approval',
        created_at: new Date().toISOString(),
        company_name: 'Test Company',
        brand_voice: 'Professional and engaging'
      };

      const mockImages = [
        {
          id: 1,
          url: 'https://example.com/image1.png',
          model: 'dall-e-3',
          quality_score: 8,
          brand_alignment: 7
        }
      ];

      const mockHooks = [
        {
          id: 1,
          hook_text: 'Transform your business with AI automation',
          score: 9,
          hook_type: 'transformation'
        }
      ];

      query
        .mockResolvedValueOnce({ rows: [mockPost] })
        .mockResolvedValueOnce({ rows: mockImages })
        .mockResolvedValueOnce({ rows: mockHooks })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/approval/posts/1')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.post_content).toBe('Detailed post content for review');
      expect(response.body.images).toHaveLength(1);
      expect(response.body.hooks).toHaveLength(1);
      expect(response.body.images[0].quality_score).toBe(8);
      expect(response.body.hooks[0].score).toBe(9);
    });

    it('should return 404 for non-existent post', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/approval/posts/999')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(404);

      expect(response.body.error).toBe('Post not found');
    });
  });

  describe('POST /api/approval/posts/:postId/approve', () => {
    const mockTransaction = (callback) => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending_approval' }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
      };
      return callback(mockClient);
    };

    beforeEach(() => {
      const { transaction } = require('../src/config/database');
      transaction.mockImplementation(mockTransaction);
    });

    it('should approve a post successfully', async () => {
      const response = await request(app)
        .post('/api/approval/posts/1/approve')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          notes: 'Looks great!'
        })
        .expect(200);

      expect(response.body.message).toBe('Post approved successfully');
    });

    it('should approve with auto-publish', async () => {
      // Mock queue for auto-publish
      jest.mock('../src/config/queue', () => ({
        publishingQueue: {
          add: jest.fn().mockResolvedValue({})
        }
      }));

      const response = await request(app)
        .post('/api/approval/posts/1/approve')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          auto_publish: true,
          scheduled_for: new Date(Date.now() + 60 * 1000).toISOString()
        })
        .expect(200);

      expect(response.body.message).toBe('Post approved successfully');
    });

    it('should reject invalid post status', async () => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ id: 1, status: 'published' }] })
      };

      const { transaction } = require('../src/config/database');
      transaction.mockImplementation((callback) => callback(mockClient));

      const response = await request(app)
        .post('/api/approval/posts/1/approve')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Post is not pending approval');
    });
  });

  describe('POST /api/approval/posts/:postId/reject', () => {
    const mockTransaction = (callback) => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending_approval', content_source_id: 1 }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
      };
      return callback(mockClient);
    };

    beforeEach(() => {
      const { transaction } = require('../src/config/database');
      transaction.mockImplementation(mockTransaction);
    });

    it('should reject a post successfully', async () => {
      const response = await request(app)
        .post('/api/approval/posts/1/reject')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          notes: 'Content needs improvement',
          regenerate: false
        })
        .expect(200);

      expect(response.body.message).toBe('Post rejected successfully');
    });

    it('should reject and trigger regeneration', async () => {
      // Mock queue is already set up in test-server.js
      const response = await request(app)
        .post('/api/approval/posts/1/reject')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          notes: 'Please regenerate with more technical content',
          regenerate: true
        })
        .expect(200);

      expect(response.body.message).toBe('Post rejected successfully');
    });
  });

  describe('PUT /api/approval/posts/:postId', () => {
    const mockTransaction = (callback) => {
      const mockClient = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending_approval', post_content: 'Old content' }] })
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] })
      };
      return callback(mockClient);
    };

    beforeEach(() => {
      const { transaction } = require('../src/config/database');
      transaction.mockImplementation(mockTransaction);
    });

    it('should update post content successfully', async () => {
      const response = await request(app)
        .put('/api/approval/posts/1')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          post_content: 'Updated post content with improvements',
          hashtags: ['#Updated', '#Improved'],
          scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          notes: 'Made improvements to content'
        })
        .expect(200);

      expect(response.body.message).toBe('Post updated successfully');
    });

    it('should validate post content length', async () => {
      const longContent = 'A'.repeat(3001);

      const response = await request(app)
        .put('/api/approval/posts/1')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          post_content: longContent
        })
        .expect(400);

      expect(response.body.error).toBe('Post content too long (max 3000 characters)');
    });

    it('should require post content', async () => {
      const response = await request(app)
        .put('/api/approval/posts/1')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          hashtags: ['#Test']
        })
        .expect(400);

      expect(response.body.error).toBe('Post content is required');
    });
  });

  describe('GET /api/approval/stats', () => {
    it('should return approval statistics', async () => {
      const mockStats = {
        pending: '3',
        approved: '15',
        rejected: '2',
        published: '10',
        avg_performance_score: '8.2',
        recent_total: '20'
      };

      const mockApprovalTime = {
        avg_approval_time_hours: '2.5'
      };

      query
        .mockResolvedValueOnce({ rows: [mockStats] })
        .mockResolvedValueOnce({ rows: [mockApprovalTime] });

      const response = await request(app)
        .get('/api/approval/stats')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.pending).toBe(3);
      expect(response.body.approved).toBe(15);
      expect(response.body.rejected).toBe(2);
      expect(response.body.published).toBe(10);
      expect(response.body.avg_performance_score).toBe('8.2');
      expect(response.body.avg_approval_time_hours).toBe(2.5);
      expect(response.body.period_days).toBe(30);
    });

    it('should accept custom time period', async () => {
      query
        .mockResolvedValueOnce({ rows: [{}] })
        .mockResolvedValueOnce({ rows: [{}] });

      const response = await request(app)
        .get('/api/approval/stats?days=7')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.period_days).toBe(7);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('7 days'),
        expect.any(Array)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      query.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/approval/pending')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(500);

      expect(response.body.error).toBe('Failed to fetch pending posts');
    });

    it('should validate company ownership', async () => {
      // Mock user with different company
      const unauthorizedUser = { ...mockUser, companyId: 999 };
      
      jest.doMock('../src/middleware/auth', () => ({
        authenticateToken: (req, res, next) => {
          req.user = unauthorizedUser;
          next();
        }
      }));

      query.mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/approval/posts/1')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(404);

      expect(response.body.error).toBe('Post not found');
    });
  });

  describe('Approval Workflow Integration', () => {
    it('should track approval history', async () => {
      const mockTransaction = (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending_approval' }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
        };
        return callback(mockClient);
      };

      const { transaction } = require('../src/config/database');
      transaction.mockImplementation(mockTransaction);

      const response = await request(app)
        .post('/api/approval/posts/1/approve')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          notes: 'Excellent content quality'
        })
        .expect(200);

      expect(response.body.message).toBe('Post approved successfully');
    });

    it('should handle image selection during approval', async () => {
      const mockTransaction = (callback) => {
        const mockClient = {
          query: jest.fn()
            .mockResolvedValueOnce({ rows: [{ id: 1, status: 'pending_approval' }] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
            .mockResolvedValueOnce({ rows: [] })
        };
        return callback(mockClient);
      };

      const { transaction } = require('../src/config/database');
      transaction.mockImplementation(mockTransaction);

      const response = await request(app)
        .post('/api/approval/posts/1/approve')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          selected_image_id: 123,
          notes: 'Great image choice'
        })
        .expect(200);

      expect(response.body.message).toBe('Post approved successfully');
    });
  });
});