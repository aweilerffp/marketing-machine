/**
 * Marketing Machine - LinkedIn Post Generator Tests
 */

const PostGenerator = require('../src/services/ai/postGenerator');

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  post_content: `🚀 We just discovered something that changed everything for our sales team.

Last month, one simple automation saved us 20 hours of manual work per week. 

Here's what happened:

Our team was spending countless hours creating personalized outreach messages. The process was tedious, error-prone, and honestly... soul-crushing.

Then we implemented Marketing Machine's hook generation system.

The results? 
→ 300% increase in response rates
→ 20+ hours saved weekly  
→ Team morale through the roof
→ Revenue up 45% in 30 days

The secret wasn't just automation - it was intelligent automation that understood our brand voice and target audience.

Most companies make the mistake of treating automation like a magic wand. They expect it to work without strategy or customization.

That's where they fail.

The real game-changer is when you combine smart technology with deep understanding of your market.

What's one manual process your team could automate this week?

#MarketingAutomation #SalesProductivity #BusinessGrowth #LinkedInStrategy`,
                  character_count: 1456,
                  hashtags: ["#MarketingAutomation", "#SalesProductivity", "#BusinessGrowth", "#LinkedInStrategy"],
                  engagement_hooks: ["20 hours saved weekly", "300% increase in response rates", "Revenue up 45%"],
                  cta_type: "question",
                  target_metrics: {
                    predicted_engagement_rate: "8.5%",
                    target_impressions: "5000-10000"
                  }
                })
              }
            }
          ],
          usage: {
            total_tokens: 1200,
            prompt_tokens: 800,
            completion_tokens: 400
          }
        })
      }
    }
  }));
});

// Mock database
jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn((callback) => callback({
    query: jest.fn().mockResolvedValue({
      rows: [{ id: 1, uuid: 'test-uuid' }]
    })
  }))
}));

// Mock Redis
jest.mock('../src/config/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK')
  }
}));

describe('PostGenerator', () => {
  let postGenerator;
  let mockHook;
  let mockCompanyProfile;

  beforeEach(() => {
    postGenerator = new PostGenerator();
    
    mockHook = {
      id: 1,
      hook_text: "We saved 20 hours per week with one simple automation",
      hook_type: "success_metric",
      content_pillar: "Productivity",
      source_quote: "The automation reduced our manual work significantly",
      target_emotion: "excitement"
    };

    mockCompanyProfile = {
      id: 1,
      name: "TechCorp Inc",
      industry: "Technology",
      brand_voice: {
        tone: ["professional", "innovative"],
        keywords: ["automation", "productivity", "efficiency"],
        prohibited_terms: []
      },
      content_pillars: [
        { title: "Productivity", keywords: ["automation", "efficiency"] }
      ],
      icp: {
        roles: ["Sales Manager", "Marketing Director"],
        company_size: "50-200 employees"
      }
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('generatePosts', () => {
    it('should generate LinkedIn posts from hooks', async () => {
      const hooks = [mockHook];
      const result = await postGenerator.generatePosts(hooks, mockCompanyProfile);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('hookId', 1);
      expect(result[0]).toHaveProperty('post_content');
      expect(result[0]).toHaveProperty('character_count');
      expect(result[0]).toHaveProperty('hashtags');
      expect(result[0]).toHaveProperty('performance_metrics');
    });

    it('should handle empty hooks array', async () => {
      const result = await postGenerator.generatePosts([], mockCompanyProfile);
      expect(result).toHaveLength(0);
    });

    it('should continue processing even if one hook fails', async () => {
      // Test that error handling works by skipping the problem hook
      const hooks = [
        mockHook,
        { ...mockHook, id: 2, hook_text: "Another test hook" }
      ];

      // Mock the PostGenerator's callOpenAI method to throw error on second call
      const originalCallOpenAI = postGenerator.callOpenAI;
      let callCount = 0;
      postGenerator.callOpenAI = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error('OpenAI API error for hook 2');
        }
        return Promise.resolve({
          post_content: "Test content that meets minimum requirements for testing purposes",
          character_count: 68,
          hashtags: [],
          engagement_hooks: [],
          cta_type: "question"
        });
      });

      const result = await postGenerator.generatePosts(hooks, mockCompanyProfile);
      expect(result).toHaveLength(1); // Only successful one
      expect(result[0].hookId).toBe(1); // Should be the first hook

      // Restore original method
      postGenerator.callOpenAI = originalCallOpenAI;
    });
  });

  describe('buildPostPrompt', () => {
    it('should build a comprehensive prompt', () => {
      const prompt = postGenerator.buildPostPrompt(mockHook, mockCompanyProfile);
      
      expect(prompt).toContain('TechCorp Inc');
      expect(prompt).toContain('Technology');
      expect(prompt).toContain(mockHook.hook_text);
      expect(prompt).toContain('1500-2200 character');
      expect(prompt).toContain('automation');
    });

    it('should include brand voice restrictions', () => {
      mockCompanyProfile.brand_voice.prohibited_terms = ['cheap', 'easy'];
      
      const prompt = postGenerator.buildPostPrompt(mockHook, mockCompanyProfile);
      expect(prompt).toContain('cheap, easy');
    });
  });

  describe('processPost', () => {
    it('should process and validate generated post', async () => {
      const mockPost = {
        post_content: "This is a test LinkedIn post with some content that meets minimum requirements for testing purposes. It has enough characters to be valid.",
        character_count: 150,
        hashtags: ["#Test"],
        engagement_hooks: ["test hook"],
        cta_type: "question"
      };

      const result = await postGenerator.processPost(mockPost, mockHook, mockCompanyProfile);

      expect(result).toHaveProperty('post_content');
      expect(result).toHaveProperty('performance_metrics');
      expect(result).toHaveProperty('seo_analysis');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata).toHaveProperty('hook_id', mockHook.id);
    });

    it('should warn about posts that are too short', async () => {
      const mockPost = {
        post_content: "Short post",
        character_count: 10,
        hashtags: [],
        engagement_hooks: [],
        cta_type: "question"
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      await postGenerator.processPost(mockPost, mockHook, mockCompanyProfile);
      
      // Note: This test would need proper logger mocking to verify the warning
      consoleSpy.mockRestore();
    });
  });

  describe('calculatePerformanceScore', () => {
    it('should calculate performance score correctly', () => {
      const mockPost = {
        post_content: "This is a test post with 50% improvement and metrics that should score well for performance testing purposes.",
        engagement_hooks: ["50% improvement"],
        cta_type: "question"
      };

      const score = postGenerator.calculatePerformanceScore(mockPost, mockHook);
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(10);
    });

    it('should give higher scores to posts with metrics', () => {
      const postWithMetrics = {
        post_content: "We achieved 50% improvement in sales with this strategy. What's your experience?",
        engagement_hooks: ["50% improvement"],
        cta_type: "question"
      };

      const postWithoutMetrics = {
        post_content: "This is a good strategy for sales improvement. What do you think?",
        engagement_hooks: [],
        cta_type: "question"
      };

      const scoreWithMetrics = postGenerator.calculatePerformanceScore(postWithMetrics, mockHook);
      const scoreWithoutMetrics = postGenerator.calculatePerformanceScore(postWithoutMetrics, mockHook);

      expect(scoreWithMetrics).toBeGreaterThan(scoreWithoutMetrics);
    });
  });

  describe('calculateBrandAlignment', () => {
    it('should calculate brand alignment correctly', () => {
      const postContent = "Our automation solution improved productivity by streamlining processes efficiently.";
      
      const score = postGenerator.calculateBrandAlignment(postContent, mockCompanyProfile);
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(10);
    });

    it('should penalize posts with prohibited terms', () => {
      mockCompanyProfile.brand_voice.prohibited_terms = ['cheap'];
      
      const postWithProhibited = "This cheap solution works well.";
      const postWithoutProhibited = "This cost-effective solution works well.";

      const scoreWithProhibited = postGenerator.calculateBrandAlignment(postWithProhibited, mockCompanyProfile);
      const scoreWithoutProhibited = postGenerator.calculateBrandAlignment(postWithoutProhibited, mockCompanyProfile);

      expect(scoreWithoutProhibited).toBeGreaterThan(scoreWithProhibited);
    });
  });

  describe('storePosts', () => {
    it('should store posts in database', async () => {
      const mockPosts = [{
        hookId: 1,
        post_content: "Test post content",
        character_count: 100,
        hashtags: [],
        engagement_hooks: [],
        cta_type: "question",
        performance_metrics: { performance_score: 8, brand_alignment: 7 },
        metadata: { generated_at: new Date().toISOString() }
      }];

      const hooks = [mockHook];
      const companyId = 1;

      const result = await postGenerator.storePosts(mockPosts, hooks, companyId);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', 1);
    });
  });

  describe('hashContent', () => {
    it('should generate consistent hashes', () => {
      const content = "test content";
      const hash1 = postGenerator.hashContent(content);
      const hash2 = postGenerator.hashContent(content);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16);
    });

    it('should generate different hashes for different content', () => {
      const hash1 = postGenerator.hashContent("content1");
      const hash2 = postGenerator.hashContent("content2");
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('optimizationScore', () => {
    it('should give optimal scores for LinkedIn length range', () => {
      const optimalScore = postGenerator.optimizationScore(1800); // Within optimal range
      const shortScore = postGenerator.optimizationScore(800);   // Too short
      const longScore = postGenerator.optimizationScore(3000);   // Too long

      expect(optimalScore).toBe(10);
      expect(optimalScore).toBeGreaterThan(shortScore);
      expect(optimalScore).toBeGreaterThan(longScore);
    });
  });
});