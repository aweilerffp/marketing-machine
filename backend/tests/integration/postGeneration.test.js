/**
 * Marketing Machine - Post Generation Integration Tests
 */

const request = require('supertest');
const app = require('../../server');
const { query } = require('../../src/config/database');
const jwt = require('jsonwebtoken');

describe('LinkedIn Post Generation Integration', () => {
  let authToken;
  let testCompanyId;
  let testHookIds;

  beforeAll(async () => {
    // Create test user and company
    const userResult = await query(`
      INSERT INTO users (email, password, name, role)
      VALUES ('test@example.com', '$2b$10$test', 'Test User', 'admin')
      RETURNING id
    `);
    const userId = userResult.rows[0].id;

    const companyResult = await query(`
      INSERT INTO companies (name, industry, description)
      VALUES ('Test Company', 'Technology', 'Test company for integration tests')
      RETURNING id
    `);
    testCompanyId = companyResult.rows[0].id;

    // Update user with company
    await query(`
      UPDATE users SET company_id = $1 WHERE id = $2
    `, [testCompanyId, userId]);

    // Generate auth token
    authToken = jwt.sign(
      { id: userId, companyId: testCompanyId, role: 'admin' },
      process.env.JWT_SECRET || 'test_secret'
    );

    // Create test content and hooks
    const contentResult = await query(`
      INSERT INTO content_sources (company_id, user_id, source_type, title, content, content_type)
      VALUES ($1, $2, 'manual', 'Test Meeting', 'This is test meeting content about productivity improvements and automation benefits.', 'meeting_transcript')
      RETURNING id
    `, [testCompanyId, userId]);

    const processingBatchResult = await query(`
      INSERT INTO processing_batches (content_source_id, company_id, status)
      VALUES ($1, $2, 'completed')
      RETURNING id
    `, [contentResult.rows[0].id, testCompanyId]);

    // Insert test hooks
    const hookPromises = [];
    for (let i = 1; i <= 3; i++) {
      hookPromises.push(
        query(`
          INSERT INTO marketing_hooks (
            processing_batch_id, company_id, hook_text, hook_type, content_pillar,
            source_quote, linkedin_hook, relevance_score, engagement_prediction, priority
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `, [
          processingBatchResult.rows[0].id,
          testCompanyId,
          `Test hook ${i} about productivity improvements`,
          'success_metric',
          'Productivity',
          'Source quote from meeting content',
          `LinkedIn version of hook ${i}`,
          8,
          7,
          i
        ])
      );
    }

    const hookResults = await Promise.all(hookPromises);
    testHookIds = hookResults.map(result => result.rows[0].id);
  });

  afterAll(async () => {
    // Clean up test data
    await query('DELETE FROM linkedin_posts WHERE company_id = $1', [testCompanyId]);
    await query('DELETE FROM marketing_hooks WHERE company_id = $1', [testCompanyId]);
    await query('DELETE FROM processing_batches WHERE company_id = $1', [testCompanyId]);
    await query('DELETE FROM content_sources WHERE company_id = $1', [testCompanyId]);
    await query('DELETE FROM companies WHERE id = $1', [testCompanyId]);
    await query('DELETE FROM users WHERE company_id = $1', [testCompanyId]);
  });

  describe('POST /api/posts/generate', () => {
    it('should generate LinkedIn posts from hooks', async () => {
      const response = await request(app)
        .post('/api/posts/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          hook_ids: testHookIds
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.posts_generated).toBe(testHookIds.length);
      expect(response.body.posts).toHaveLength(testHookIds.length);

      // Verify posts were stored in database
      const storedPosts = await query(`
        SELECT * FROM linkedin_posts WHERE company_id = $1
      `, [testCompanyId]);

      expect(storedPosts.rows).toHaveLength(testHookIds.length);
      
      // Verify post structure
      const firstPost = storedPosts.rows[0];
      expect(firstPost.post_content).toBeDefined();
      expect(firstPost.character_count).toBeGreaterThan(0);
      expect(firstPost.performance_score).toBeGreaterThanOrEqual(1);
      expect(firstPost.performance_score).toBeLessThanOrEqual(10);
      expect(firstPost.status).toBe('draft');
    });

    it('should reject invalid hook IDs', async () => {
      await request(app)
        .post('/api/posts/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          hook_ids: [99999] // Non-existent hook ID
        })
        .expect(403);
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/posts/generate')
        .send({
          hook_ids: testHookIds
        })
        .expect(401);
    });

    it('should validate request body', async () => {
      await request(app)
        .post('/api/posts/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing hook_ids
        })
        .expect(400);
    });
  });

  describe('GET /api/posts', () => {
    beforeAll(async () => {
      // Generate some posts first
      await request(app)
        .post('/api/posts/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          hook_ids: [testHookIds[0]]
        });
    });

    it('should fetch company posts', async () => {
      const response = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.posts).toBeDefined();
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination.total).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/posts?status=draft')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.posts.every(post => post.status === 'draft')).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/posts?limit=1&offset=0')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.posts).toHaveLength(1);
      expect(response.body.pagination.limit).toBe(1);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/posts')
        .expect(401);
    });
  });

  describe('GET /api/posts/:id', () => {
    let testPostId;

    beforeAll(async () => {
      // Create a test post
      const generateResponse = await request(app)
        .post('/api/posts/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          hook_ids: [testHookIds[0]]
        });

      const postsResponse = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${authToken}`);
      
      testPostId = postsResponse.body.posts[0].id;
    });

    it('should fetch individual post', async () => {
      const response = await request(app)
        .get(`/api/posts/${testPostId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(testPostId);
      expect(response.body.post_content).toBeDefined();
      expect(response.body.hook).toBeDefined();
      expect(response.body.timestamps).toBeDefined();
    });

    it('should return 404 for non-existent post', async () => {
      await request(app)
        .get('/api/posts/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .get(`/api/posts/${testPostId}`)
        .expect(401);
    });
  });

  describe('PUT /api/posts/:id', () => {
    let testPostId;

    beforeAll(async () => {
      const postsResponse = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${authToken}`);
      
      testPostId = postsResponse.body.posts[0].id;
    });

    it('should update post content', async () => {
      const newContent = 'Updated post content for testing purposes. This content meets the minimum character requirements.';
      
      const response = await request(app)
        .put(`/api/posts/${testPostId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          post_content: newContent,
          status: 'approved'
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify update in database
      const updatedPost = await query(`
        SELECT * FROM linkedin_posts WHERE id = $1
      `, [testPostId]);

      expect(updatedPost.rows[0].post_content).toBe(newContent);
      expect(updatedPost.rows[0].status).toBe('approved');
      expect(updatedPost.rows[0].character_count).toBe(newContent.length);
    });

    it('should validate content length', async () => {
      await request(app)
        .put(`/api/posts/${testPostId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          post_content: 'Too short' // Less than 50 characters
        })
        .expect(400);
    });

    it('should reject invalid status', async () => {
      await request(app)
        .put(`/api/posts/${testPostId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'invalid_status'
        })
        .expect(400);
    });
  });

  describe('DELETE /api/posts/:id', () => {
    let testPostId;

    beforeAll(async () => {
      // Create a post for deletion test
      await request(app)
        .post('/api/posts/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          hook_ids: [testHookIds[1]]
        });

      const postsResponse = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${authToken}`);
      
      // Find a draft post for deletion
      testPostId = postsResponse.body.posts.find(post => post.status === 'draft').id;
    });

    it('should delete draft post', async () => {
      const response = await request(app)
        .delete(`/api/posts/${testPostId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify deletion
      const deletedPost = await query(`
        SELECT * FROM linkedin_posts WHERE id = $1
      `, [testPostId]);

      expect(deletedPost.rows).toHaveLength(0);
    });

    it('should not delete published post', async () => {
      // Create and mark post as published
      await request(app)
        .post('/api/posts/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          hook_ids: [testHookIds[2]]
        });

      const postsResponse = await request(app)
        .get('/api/posts')
        .set('Authorization', `Bearer ${authToken}`);
      
      const newPostId = postsResponse.body.posts[0].id;

      // Mark as published
      await query(`
        UPDATE linkedin_posts SET status = 'published' WHERE id = $1
      `, [newPostId]);

      // Try to delete
      await request(app)
        .delete(`/api/posts/${newPostId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /api/posts/stats/overview', () => {
    it('should return post statistics', async () => {
      const response = await request(app)
        .get('/api/posts/stats/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.overview).toBeDefined();
      expect(response.body.status_breakdown).toBeDefined();
      expect(response.body.recent_activity).toBeDefined();
      expect(response.body.overview.total_posts).toBeGreaterThanOrEqual(0);
    });
  });
});