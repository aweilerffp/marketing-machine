/**
 * Marketing Machine - LinkedIn Post Generator
 * Creates optimized LinkedIn posts from marketing hooks
 */

const OpenAI = require('openai');
const { query, transaction } = require('../../config/database');
const logger = require('../../utils/logger').ai;
const { cache } = require('../../config/redis');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * LinkedIn Post Generator Class
 */
class PostGenerator {
  constructor() {
    this.model = process.env.OPENAI_MODEL || 'gpt-4';
    this.maxRetries = 3;
    this.targetLength = { min: 1500, max: 2200 };
  }

  /**
   * Generate LinkedIn posts from marketing hooks
   * @param {Array} hooks - Marketing hooks to convert to posts
   * @param {Object} companyProfile - Company profile and brand voice
   * @returns {Promise<Array>} Array of generated LinkedIn posts
   */
  async generatePosts(hooks, companyProfile) {
    try {
      logger.info('Starting LinkedIn post generation', {
        hooksCount: hooks.length,
        companyId: companyProfile.id,
        model: this.model
      });

      const generatedPosts = [];

      for (const hook of hooks) {
        try {
          const prompt = this.buildPostPrompt(hook, companyProfile);
          
          // Check cache first
          const cacheKey = `post:${this.hashContent(hook.hook_text + JSON.stringify(companyProfile))}`;
          const cachedPost = await cache.get(cacheKey);
          
          if (cachedPost) {
            logger.info('Using cached LinkedIn post', { hookId: hook.id, cacheKey });
            generatedPosts.push({ ...cachedPost, hookId: hook.id });
            continue;
          }

          // Generate post with retry logic
          const post = await this.callOpenAI(prompt);
          
          // Process and validate post
          const processedPost = await this.processPost(post, hook, companyProfile);
          
          // Cache the result
          await cache.set(cacheKey, processedPost, 12 * 60 * 60); // 12 hours
          
          generatedPosts.push({ ...processedPost, hookId: hook.id });

        } catch (error) {
          logger.error('Post generation failed for hook', {
            hookId: hook.id,
            error: error.message
          });
          continue; // Skip this hook and continue with others
        }
      }

      logger.info('LinkedIn post generation completed', {
        hooksProcessed: hooks.length,
        postsGenerated: generatedPosts.length,
        companyId: companyProfile.id
      });

      return generatedPosts;

    } catch (error) {
      logger.error('LinkedIn post generation failed', {
        error: error.message,
        stack: error.stack,
        companyId: companyProfile?.id
      });
      throw error;
    }
  }

  /**
   * Build LinkedIn post generation prompt
   * @param {Object} hook - Marketing hook
   * @param {Object} companyProfile - Company profile
   * @returns {string} Formatted prompt
   */
  buildPostPrompt(hook, companyProfile) {
    const { name, industry, brand_voice, content_pillars, icp } = companyProfile;
    const { hook_text, content_pillar, source_quote, hook_type, target_emotion } = hook;

    return `You are Marketing Machine's expert LinkedIn content creator for ${name}.

COMPANY CONTEXT:
- Company: ${name}
- Industry: ${industry}
- Target Audience: ${JSON.stringify(icp)}
- Brand Voice: ${JSON.stringify(brand_voice)}
- Content Pillars: ${JSON.stringify(content_pillars)}

HOOK TO EXPAND:
Hook: "${hook_text}"
Type: ${hook_type}
Content Pillar: ${content_pillar}
Target Emotion: ${target_emotion}
Source Quote: "${source_quote}"

TASK: Transform this hook into a compelling 1500-2200 character LinkedIn post that maximizes engagement.

POST STRUCTURE REQUIREMENTS:
1. Opening Hook (1-2 lines) - Stop scroll, create curiosity
2. Problem/Context (2-3 lines) - Relate to audience pain points
3. Story/Example (3-4 lines) - Specific, concrete example with metrics
4. Key Insight (2-3 lines) - Main takeaway or learning
5. Call-to-Action (1-2 lines) - Engage comments, ask questions

CONTENT GUIDELINES:
- Length: 1500-2200 characters (LinkedIn's algorithm sweet spot)
- Use line breaks for readability (double line breaks between sections)
- Include specific numbers, metrics, percentages when possible
- Match brand voice tone: ${brand_voice?.tone?.join(', ') || 'professional'}
- Avoid prohibited terms: ${brand_voice?.prohibited_terms?.join(', ') || 'none'}
- Target emotion: ${target_emotion}
- Include relevant hashtags (3-5 max)

ENGAGEMENT OPTIMIZATION:
- Ask a thought-provoking question to drive comments
- Use "you" to make it personal
- Include contrarian or surprising insights
- Create urgency or FOMO where appropriate
- Make it actionable and practical

EXAMPLES OF HIGH-PERFORMING LINKEDIN POSTS:
- Start with attention-grabbing statements
- Include personal stories or client examples
- End with questions that invite discussion
- Use emojis sparingly but strategically
- Break up text with white space

INDUSTRY CONTEXT: Consider ${industry} specific challenges, terminology, and pain points.

Generate ONE optimized LinkedIn post that will drive maximum engagement for our target audience. Make it feel authentic to our brand voice while being highly shareable.

OUTPUT FORMAT: Return as JSON with:
{
  "post_content": "Full LinkedIn post text",
  "character_count": number,
  "hashtags": ["#hashtag1", "#hashtag2"],
  "engagement_hooks": ["hook1", "hook2"],
  "cta_type": "question|advice|share|comment",
  "target_metrics": {
    "predicted_engagement_rate": "percentage",
    "target_impressions": "estimate"
  }
}`;
  }

  /**
   * Call OpenAI API with retry logic for post generation
   * @param {string} prompt - Prompt to send
   * @returns {Promise<Object>} Parsed post
   */
  async callOpenAI(prompt, attempt = 1) {
    try {
      const startTime = Date.now();
      
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are Marketing Machine's LinkedIn expert. Create engaging, algorithm-optimized posts that drive business results. Always return valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.8, // Slightly more creative for posts
        max_tokens: 4000,
        response_format: { type: "json_object" }
      });

      const duration = Date.now() - startTime;
      
      logger.info('OpenAI post generation successful', {
        model: this.model,
        duration: `${duration}ms`,
        tokensUsed: response.usage?.total_tokens,
        attempt
      });

      // Parse the response
      const content = response.choices[0].message.content;
      const parsedResponse = JSON.parse(content);

      // Validate required fields
      if (!parsedResponse.post_content) {
        throw new Error('No post content generated');
      }

      return parsedResponse;

    } catch (error) {
      logger.error('OpenAI post generation failed', {
        error: error.message,
        attempt,
        model: this.model
      });

      // Retry logic
      if (attempt < this.maxRetries && !error.message.includes('billing')) {
        logger.info('Retrying OpenAI post generation', { attempt: attempt + 1 });
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        return this.callOpenAI(prompt, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Process and validate generated post
   * @param {Object} post - Raw post from AI
   * @param {Object} hook - Original hook
   * @param {Object} companyProfile - Company profile
   * @returns {Object} Processed post
   */
  async processPost(post, hook, companyProfile) {
    try {
      const postContent = post.post_content.trim();
      const characterCount = postContent.length;
      
      // Validate length
      if (characterCount < this.targetLength.min) {
        logger.warn('Post too short', { characterCount, hookId: hook.id });
      } else if (characterCount > this.targetLength.max) {
        logger.warn('Post too long', { characterCount, hookId: hook.id });
      }

      // Calculate performance scores
      const performanceScore = this.calculatePerformanceScore(post, hook);
      const brandAlignment = this.calculateBrandAlignment(postContent, companyProfile);

      return {
        post_content: postContent,
        character_count: characterCount,
        hashtags: post.hashtags || [],
        engagement_hooks: post.engagement_hooks || [],
        cta_type: post.cta_type || 'question',
        target_metrics: post.target_metrics || {},
        performance_metrics: {
          performance_score: performanceScore,
          brand_alignment: brandAlignment,
          readability_score: this.calculateReadabilityScore(postContent),
          length_optimization: this.optimizationScore(characterCount)
        },
        seo_analysis: {
          keyword_density: this.analyzeKeywords(postContent, companyProfile),
          hashtag_relevance: this.analyzeHashtagRelevance(post.hashtags || [], companyProfile)
        },
        metadata: {
          generated_at: new Date().toISOString(),
          model_used: this.model,
          hook_id: hook.id,
          processing_version: '1.0'
        }
      };

    } catch (error) {
      logger.error('Post processing error', {
        error: error.message,
        hookId: hook.id
      });
      throw error;
    }
  }

  /**
   * Calculate post performance score
   * @param {Object} post - Generated post
   * @param {Object} hook - Original hook
   * @returns {number} Performance score (1-10)
   */
  calculatePerformanceScore(post, hook) {
    let score = 5;

    // Length optimization
    const length = post.post_content.length;
    if (length >= this.targetLength.min && length <= this.targetLength.max) {
      score += 2;
    }

    // Engagement hooks presence
    if (post.engagement_hooks && post.engagement_hooks.length > 0) {
      score += 1;
    }

    // CTA presence
    if (post.cta_type && post.cta_type !== 'none') {
      score += 1;
    }

    // Numbers and metrics (from hook)
    if (/\d+[%$]|\\d+x|\\d+\\s*(percent|times|dollars)/.test(post.post_content)) {
      score += 1;
    }

    // Question for engagement
    if (post.post_content.includes('?')) {
      score += 0.5;
    }

    return Math.min(10, Math.max(1, Math.round(score)));
  }

  /**
   * Calculate brand alignment score
   * @param {string} postContent - Post content
   * @param {Object} companyProfile - Company profile
   * @returns {number} Brand alignment score (1-10)
   */
  calculateBrandAlignment(postContent, companyProfile) {
    let score = 5;

    // Brand voice keywords
    if (companyProfile.brand_voice?.keywords) {
      const keywords = companyProfile.brand_voice.keywords.map(k => k.toLowerCase());
      const contentLower = postContent.toLowerCase();
      
      const matchedKeywords = keywords.filter(keyword => contentLower.includes(keyword));
      score += matchedKeywords.length * 0.5;
    }

    // Prohibited terms check
    if (companyProfile.brand_voice?.prohibited_terms) {
      const prohibited = companyProfile.brand_voice.prohibited_terms.map(t => t.toLowerCase());
      const contentLower = postContent.toLowerCase();
      
      const hasProhibited = prohibited.some(term => contentLower.includes(term));
      if (hasProhibited) score -= 3;
    }

    // Tone alignment (basic check)
    const tones = companyProfile.brand_voice?.tone || [];
    if (tones.includes('professional') && /\b(insights?|analysis|strategic?|solutions?)\b/i.test(postContent)) {
      score += 1;
    }

    return Math.min(10, Math.max(1, Math.round(score)));
  }

  /**
   * Calculate readability score
   * @param {string} content - Post content
   * @returns {number} Readability score (1-10)
   */
  calculateReadabilityScore(content) {
    // Simple readability metrics
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const avgWordsPerSentence = words.length / sentences.length;
    
    // LinkedIn optimal: 15-20 words per sentence
    let score = 5;
    if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 25) {
      score += 2;
    }

    // Line breaks for readability
    const lineBreaks = (content.match(/\n\n/g) || []).length;
    if (lineBreaks >= 2 && lineBreaks <= 6) {
      score += 1;
    }

    return Math.min(10, Math.max(1, Math.round(score)));
  }

  /**
   * Calculate length optimization score
   * @param {number} characterCount - Character count
   * @returns {number} Optimization score (1-10)
   */
  optimizationScore(characterCount) {
    if (characterCount < 1000) return 3;
    if (characterCount < 1500) return 6;
    if (characterCount >= 1500 && characterCount <= 2200) return 10;
    if (characterCount <= 2500) return 7;
    return 4;
  }

  /**
   * Analyze keyword usage
   * @param {string} content - Post content
   * @param {Object} companyProfile - Company profile
   * @returns {number} Keyword density score
   */
  analyzeKeywords(content, companyProfile) {
    if (!companyProfile.brand_voice?.keywords) return 5;

    const keywords = companyProfile.brand_voice.keywords.map(k => k.toLowerCase());
    const contentLower = content.toLowerCase();
    const words = contentLower.split(/\s+/);
    
    let keywordCount = 0;
    keywords.forEach(keyword => {
      const matches = contentLower.match(new RegExp(`\\b${keyword}\\b`, 'g')) || [];
      keywordCount += matches.length;
    });

    const density = (keywordCount / words.length) * 100;
    
    // Optimal: 1-3% keyword density
    if (density >= 1 && density <= 3) return 10;
    if (density >= 0.5 && density < 1) return 7;
    if (density > 3 && density <= 5) return 6;
    return 3;
  }

  /**
   * Analyze hashtag relevance
   * @param {Array} hashtags - Post hashtags
   * @param {Object} companyProfile - Company profile
   * @returns {number} Hashtag relevance score
   */
  analyzeHashtagRelevance(hashtags, companyProfile) {
    if (!hashtags.length) return 3;
    
    let score = 5;
    
    // Check if hashtags relate to industry
    const industry = companyProfile.industry?.toLowerCase() || '';
    const industryRelated = hashtags.some(tag => 
      tag.toLowerCase().includes(industry) || 
      industry.includes(tag.toLowerCase().replace('#', ''))
    );
    
    if (industryRelated) score += 2;
    
    // Optimal hashtag count (3-5)
    if (hashtags.length >= 3 && hashtags.length <= 5) {
      score += 2;
    } else if (hashtags.length > 5) {
      score -= 1;
    }

    return Math.min(10, Math.max(1, score));
  }

  /**
   * Store generated posts in database
   * @param {Array} posts - Generated posts
   * @param {Array} hooks - Original hooks
   * @param {number} companyId - Company ID
   * @returns {Promise<Array>} Stored posts with IDs
   */
  async storePosts(posts, hooks, companyId) {
    try {
      const storedPosts = [];

      await transaction(async (client) => {
        for (const post of posts) {
          const hook = hooks.find(h => h.id === post.hookId);
          
          const result = await client.query(`
            INSERT INTO linkedin_posts (
              company_id,
              marketing_hook_id,
              post_content,
              character_count,
              hashtags,
              engagement_hooks,
              cta_type,
              performance_score,
              brand_alignment_score,
              status,
              metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10)
            RETURNING *
          `, [
            companyId,
            post.hookId,
            post.post_content,
            post.character_count,
            JSON.stringify(post.hashtags),
            JSON.stringify(post.engagement_hooks),
            post.cta_type,
            post.performance_metrics.performance_score,
            post.performance_metrics.brand_alignment,
            JSON.stringify({
              ...post.metadata,
              target_metrics: post.target_metrics,
              performance_metrics: post.performance_metrics,
              seo_analysis: post.seo_analysis
            })
          ]);

          storedPosts.push(result.rows[0]);
        }
      });

      logger.info('LinkedIn posts stored successfully', {
        count: storedPosts.length,
        companyId
      });

      return storedPosts;

    } catch (error) {
      logger.error('Error storing LinkedIn posts', {
        error: error.message,
        postsCount: posts.length,
        companyId
      });
      throw error;
    }
  }

  /**
   * Hash content for caching
   * @param {string} content - Content to hash
   * @returns {string} Hash string
   */
  hashContent(content) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Get post generation statistics
   * @param {number} companyId - Company ID
   * @returns {Promise<Object>} Statistics
   */
  async getStats(companyId) {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_posts,
          AVG(performance_score) as avg_performance,
          AVG(brand_alignment_score) as avg_brand_alignment,
          AVG(character_count) as avg_length,
          COUNT(CASE WHEN status = 'published' THEN 1 END) as published_count
        FROM linkedin_posts
        WHERE company_id = $1
      `, [companyId]);

      return {
        total_posts: parseInt(result.rows[0].total_posts),
        avg_performance: parseFloat(result.rows[0].avg_performance || 0).toFixed(1),
        avg_brand_alignment: parseFloat(result.rows[0].avg_brand_alignment || 0).toFixed(1),
        avg_length: parseInt(result.rows[0].avg_length || 0),
        published_count: parseInt(result.rows[0].published_count)
      };

    } catch (error) {
      logger.error('Error getting post stats', { error: error.message, companyId });
      return {
        total_posts: 0,
        avg_performance: 0,
        avg_brand_alignment: 0,
        avg_length: 0,
        published_count: 0
      };
    }
  }
}

module.exports = PostGenerator;