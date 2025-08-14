/**
 * Marketing Machine - Hook Generation Engine
 * Extracts 10 marketing hooks from meeting transcripts and content
 */

const OpenAI = require('openai');
const { query } = require('../../config/database');
const logger = require('../../utils/logger').ai;
const { cache } = require('../../config/redis');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Marketing Machine Hook Generator Class
 */
class HookGenerator {
  constructor() {
    this.model = process.env.OPENAI_MODEL || 'gpt-4';
    this.maxRetries = 3;
    this.timeout = 30000; // 30 seconds
  }

  /**
   * Generate marketing hooks from content
   * @param {string} content - Content to analyze
   * @param {Object} companyProfile - Company profile and brand voice
   * @returns {Promise<Array>} Array of marketing hooks
   */
  async generateHooks(content, companyProfile) {
    try {
      logger.info('Starting hook generation', {
        contentLength: content.length,
        companyId: companyProfile.id,
        model: this.model
      });

      // Build the prompt
      const prompt = this.buildPrompt(content, companyProfile);
      
      // Check cache first
      const cacheKey = `hooks:${this.hashContent(content + JSON.stringify(companyProfile))}`;
      const cachedHooks = await cache.get(cacheKey);
      
      if (cachedHooks) {
        logger.info('Using cached hooks', { cacheKey });
        return cachedHooks;
      }

      // Call OpenAI API with retry logic
      const hooks = await this.callOpenAI(prompt);
      
      // Validate and score hooks
      const processedHooks = await this.processHooks(hooks, content, companyProfile);
      
      // Cache the results
      await cache.set(cacheKey, processedHooks, 24 * 60 * 60); // 24 hours
      
      logger.info('Hook generation completed', {
        hooksGenerated: processedHooks.length,
        totalCost: this.calculateCost(content.length),
        companyId: companyProfile.id
      });

      return processedHooks;

    } catch (error) {
      logger.error('Hook generation failed', {
        error: error.message,
        stack: error.stack,
        contentLength: content?.length,
        companyId: companyProfile?.id
      });
      throw error;
    }
  }

  /**
   * Build the Marketing Machine prompt
   * @param {string} content - Content to analyze
   * @param {Object} companyProfile - Company profile
   * @returns {string} Formatted prompt
   */
  buildPrompt(content, companyProfile) {
    const { name, industry, brand_voice, content_pillars, icp } = companyProfile;

    return `You are Marketing Machine's expert content strategist for ${name}.

COMPANY CONTEXT:
- Company: ${name}
- Industry: ${industry}
- Target Audience (ICP): ${JSON.stringify(icp)}
- Brand Voice: ${JSON.stringify(brand_voice)}
- Content Pillars: ${JSON.stringify(content_pillars)}

CONTENT TO ANALYZE:
"""
${content}
"""

TASK: Extract exactly 10 marketing hooks from this content that would resonate with our target audience.

For each hook, provide:
1. hook_text: Compelling opening line (10-15 words max)
2. content_pillar: Which content pillar this fits into
3. hook_type: Type of hook (pain_point, success_metric, industry_insight, customer_story, product_benefit, market_trend, problem_solution, case_study, thought_leadership, behind_scenes)
4. source_quote: Exact quote from content that inspired this hook
5. linkedin_hook: 150-word LinkedIn post opener using this hook
6. tweet_version: 240-character Twitter version
7. blog_title: Compelling blog post title
8. target_emotion: Primary emotion to evoke (curiosity, urgency, aspiration, validation, concern, excitement)
9. engagement_prediction: Predicted engagement level (1-10)
10. relevance_score: Relevance to our ICP (1-10)

HOOK CRITERIA:
- Must be specific and actionable
- Should include concrete numbers/metrics when available
- Must align with our brand voice: ${brand_voice?.tone?.join(', ') || 'professional'}
- Avoid these prohibited terms: ${brand_voice?.prohibited_terms?.join(', ') || 'none'}
- Focus on pain points and solutions our ICP faces
- Include industry-specific terminology when relevant

OUTPUT FORMAT: Return as JSON array with exactly 10 hooks. Each hook must be a complete object with all fields.

EXAMPLES OF STRONG HOOKS:
- "We lost $50K in 3 days because of one catalog error"
- "This 5-minute automation saved us 20 hours per week"
- "Why 73% of Amazon sellers fail in their first year"
- "The hidden cost of manual inventory management"
- "How we increased conversion rates by 45% in 30 days"

Generate hooks that would stop scroll and drive engagement on LinkedIn. Focus on specific, measurable outcomes and relatable business problems.`;
  }

  /**
   * Call OpenAI API with retry logic
   * @param {string} prompt - Prompt to send
   * @returns {Promise<Array>} Parsed hooks
   */
  async callOpenAI(prompt, attempt = 1) {
    try {
      const startTime = Date.now();
      
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are Marketing Machine, an expert at extracting compelling marketing hooks from business content. Always return valid JSON arrays."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: "json_object" }
      });

      const duration = Date.now() - startTime;
      
      logger.info('OpenAI API call successful', {
        model: this.model,
        duration: `${duration}ms`,
        tokensUsed: response.usage?.total_tokens,
        attempt
      });

      // Parse the response
      const content = response.choices[0].message.content;
      let parsedResponse;
      
      try {
        parsedResponse = JSON.parse(content);
      } catch (parseError) {
        logger.warn('Failed to parse JSON response, attempting to extract', { content });
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsedResponse = { hooks: JSON.parse(jsonMatch[0]) };
        } else {
          throw new Error('Invalid JSON response from OpenAI');
        }
      }

      // Extract hooks array
      const hooks = parsedResponse.hooks || parsedResponse;
      
      if (!Array.isArray(hooks)) {
        throw new Error('Response is not an array of hooks');
      }

      if (hooks.length !== 10) {
        logger.warn('Expected 10 hooks, got different count', { count: hooks.length });
      }

      return hooks;

    } catch (error) {
      logger.error('OpenAI API call failed', {
        error: error.message,
        attempt,
        model: this.model
      });

      // Retry logic
      if (attempt < this.maxRetries && !error.message.includes('billing')) {
        logger.info('Retrying OpenAI API call', { attempt: attempt + 1 });
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        return this.callOpenAI(prompt, attempt + 1);
      }

      throw error;
    }
  }

  /**
   * Process and validate hooks
   * @param {Array} hooks - Raw hooks from AI
   * @param {string} originalContent - Original content for validation
   * @param {Object} companyProfile - Company profile
   * @returns {Promise<Array>} Processed hooks
   */
  async processHooks(hooks, originalContent, companyProfile) {
    const processedHooks = [];

    for (const [index, hook] of hooks.entries()) {
      try {
        // Validate required fields
        const requiredFields = ['hook_text', 'hook_type', 'source_quote', 'linkedin_hook', 'tweet_version', 'blog_title'];
        for (const field of requiredFields) {
          if (!hook[field]) {
            logger.warn('Missing required field in hook', { index, field });
            hook[field] = `Generated ${field} for hook ${index + 1}`;
          }
        }

        // Calculate scores
        const relevanceScore = hook.relevance_score || this.calculateRelevanceScore(hook, companyProfile);
        const engagementPrediction = hook.engagement_prediction || this.predictEngagement(hook);
        
        // Assign content pillar if missing
        const contentPillar = hook.content_pillar || this.assignContentPillar(hook, companyProfile.content_pillars);
        
        // Build processed hook
        const processedHook = {
          hook_text: hook.hook_text.trim(),
          hook_type: hook.hook_type || 'industry_insight',
          content_pillar: contentPillar,
          source_quote: hook.source_quote.trim(),
          source_context: this.extractContext(hook.source_quote, originalContent),
          linkedin_hook: hook.linkedin_hook.trim(),
          tweet_version: hook.tweet_version.trim(),
          blog_title: hook.blog_title.trim(),
          target_emotion: hook.target_emotion || 'curiosity',
          relevance_score: Math.min(10, Math.max(1, relevanceScore)),
          engagement_prediction: Math.min(10, Math.max(1, engagementPrediction)),
          priority: this.calculatePriority(relevanceScore, engagementPrediction),
          word_count: {
            hook: hook.hook_text.split(' ').length,
            linkedin: hook.linkedin_hook.split(' ').length,
            tweet: hook.tweet_version.length
          },
          metadata: {
            generated_at: new Date().toISOString(),
            model_used: this.model,
            processing_version: '1.0'
          }
        };

        processedHooks.push(processedHook);

      } catch (error) {
        logger.error('Error processing hook', {
          error: error.message,
          hookIndex: index,
          hook
        });
        
        // Continue with other hooks rather than failing completely
        continue;
      }
    }

    // Sort by priority (highest first)
    processedHooks.sort((a, b) => b.priority - a.priority);

    logger.info('Hooks processed successfully', {
      totalProcessed: processedHooks.length,
      averageRelevance: (processedHooks.reduce((sum, h) => sum + h.relevance_score, 0) / processedHooks.length).toFixed(1),
      averageEngagement: (processedHooks.reduce((sum, h) => sum + h.engagement_prediction, 0) / processedHooks.length).toFixed(1)
    });

    return processedHooks;
  }

  /**
   * Calculate relevance score based on company profile
   * @param {Object} hook - Hook to score
   * @param {Object} companyProfile - Company profile
   * @returns {number} Relevance score (1-10)
   */
  calculateRelevanceScore(hook, companyProfile) {
    let score = 5; // Base score

    // Check brand voice alignment
    if (companyProfile.brand_voice?.keywords) {
      const keywords = companyProfile.brand_voice.keywords.map(k => k.toLowerCase());
      const hookText = (hook.hook_text + ' ' + hook.linkedin_hook).toLowerCase();
      
      const matchedKeywords = keywords.filter(keyword => hookText.includes(keyword));
      score += matchedKeywords.length * 0.5;
    }

    // Check for prohibited terms
    if (companyProfile.brand_voice?.prohibited_terms) {
      const prohibited = companyProfile.brand_voice.prohibited_terms.map(t => t.toLowerCase());
      const hookText = (hook.hook_text + ' ' + hook.linkedin_hook).toLowerCase();
      
      const hasProhibited = prohibited.some(term => hookText.includes(term));
      if (hasProhibited) score -= 2;
    }

    // Content pillar alignment
    if (hook.content_pillar && companyProfile.content_pillars) {
      const pillarMatch = companyProfile.content_pillars.some(pillar => 
        pillar.title.toLowerCase().includes(hook.content_pillar.toLowerCase())
      );
      if (pillarMatch) score += 1;
    }

    return Math.min(10, Math.max(1, Math.round(score)));
  }

  /**
   * Predict engagement potential
   * @param {Object} hook - Hook to analyze
   * @returns {number} Engagement prediction (1-10)
   */
  predictEngagement(hook) {
    let score = 5;

    // Hook text analysis
    const hookText = hook.hook_text.toLowerCase();
    
    // Numbers and metrics boost engagement
    if (/\d+[%$]|\d+x|\d+\s*(percent|times|dollars|hours|days|weeks|months)/.test(hookText)) {
      score += 2;
    }

    // Question hooks tend to engage
    if (hookText.includes('?') || hookText.startsWith('why') || hookText.startsWith('how')) {
      score += 1.5;
    }

    // Emotional triggers
    const emotionalWords = ['failed', 'mistake', 'secret', 'shocking', 'surprising', 'breakthrough', 'disaster'];
    if (emotionalWords.some(word => hookText.includes(word))) {
      score += 1;
    }

    // Time-based urgency
    if (/in \d+ (days?|weeks?|months?)/.test(hookText)) {
      score += 0.5;
    }

    // Length optimization (LinkedIn performs better with certain lengths)
    const linkedInLength = hook.linkedin_hook?.length || 0;
    if (linkedInLength >= 150 && linkedInLength <= 200) {
      score += 0.5;
    }

    return Math.min(10, Math.max(1, Math.round(score)));
  }

  /**
   * Assign content pillar to hook
   * @param {Object} hook - Hook to categorize
   * @param {Array} contentPillars - Available content pillars
   * @returns {string} Assigned content pillar
   */
  assignContentPillar(hook, contentPillars = []) {
    if (hook.content_pillar) return hook.content_pillar;

    const hookText = (hook.hook_text + ' ' + hook.linkedin_hook).toLowerCase();
    
    // Try to match with existing pillars
    for (const pillar of contentPillars) {
      const pillarKeywords = pillar.keywords || [];
      if (pillarKeywords.some(keyword => hookText.includes(keyword.toLowerCase()))) {
        return pillar.title;
      }
    }

    // Default categorization based on hook type
    const typeMapping = {
      pain_point: 'Problem Solving',
      success_metric: 'Results & Metrics',
      customer_story: 'Customer Success',
      product_benefit: 'Product Innovation',
      industry_insight: 'Industry Insights',
      market_trend: 'Market Analysis',
      thought_leadership: 'Leadership',
      case_study: 'Case Studies',
      behind_scenes: 'Company Culture'
    };

    return typeMapping[hook.hook_type] || 'General Content';
  }

  /**
   * Calculate priority score
   * @param {number} relevanceScore - Relevance score
   * @param {number} engagementPrediction - Engagement prediction
   * @returns {number} Priority score
   */
  calculatePriority(relevanceScore, engagementPrediction) {
    // Weighted combination: relevance is slightly more important
    return Math.round((relevanceScore * 0.6) + (engagementPrediction * 0.4));
  }

  /**
   * Extract surrounding context for source quote
   * @param {string} quote - Quote to find context for
   * @param {string} content - Full content
   * @returns {string} Context around the quote
   */
  extractContext(quote, content) {
    try {
      const quoteWords = quote.toLowerCase().split(' ').slice(0, 5); // First 5 words
      const contentLower = content.toLowerCase();
      
      // Find approximate location of quote
      let bestMatch = -1;
      let bestScore = 0;
      
      const words = contentLower.split(' ');
      for (let i = 0; i < words.length - quoteWords.length; i++) {
        let score = 0;
        for (let j = 0; j < quoteWords.length; j++) {
          if (words[i + j] && words[i + j].includes(quoteWords[j])) {
            score++;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestMatch = i;
        }
      }

      if (bestMatch >= 0 && bestScore > 2) {
        // Extract context (20 words before and after)
        const start = Math.max(0, bestMatch - 20);
        const end = Math.min(words.length, bestMatch + 40);
        const context = words.slice(start, end).join(' ');
        
        return context.length > 200 ? context.substring(0, 200) + '...' : context;
      }

      // Fallback: return first 200 characters of content
      return content.substring(0, 200) + (content.length > 200 ? '...' : '');

    } catch (error) {
      logger.error('Error extracting context', { error: error.message });
      return 'Context extraction failed';
    }
  }

  /**
   * Calculate estimated cost for processing
   * @param {number} contentLength - Length of content
   * @returns {number} Estimated cost in USD
   */
  calculateCost(contentLength) {
    // Rough calculation based on GPT-4 pricing
    const estimatedTokens = Math.ceil(contentLength / 4) + 4000; // Input + output tokens
    const costPerToken = 0.00003; // Approximate GPT-4 cost
    return Math.round(estimatedTokens * costPerToken * 100) / 100; // Round to cents
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
   * Get hook generation statistics
   * @param {number} companyId - Company ID
   * @returns {Promise<Object>} Statistics
   */
  async getStats(companyId) {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_hooks,
          AVG(relevance_score) as avg_relevance,
          AVG(engagement_prediction) as avg_engagement,
          COUNT(DISTINCT content_source_id) as content_pieces_processed
        FROM marketing_hooks
        WHERE company_id = $1
      `, [companyId]);

      return {
        total_hooks: parseInt(result.rows[0].total_hooks),
        avg_relevance: parseFloat(result.rows[0].avg_relevance || 0).toFixed(1),
        avg_engagement: parseFloat(result.rows[0].avg_engagement || 0).toFixed(1),
        content_pieces_processed: parseInt(result.rows[0].content_pieces_processed)
      };

    } catch (error) {
      logger.error('Error getting hook stats', { error: error.message, companyId });
      return {
        total_hooks: 0,
        avg_relevance: 0,
        avg_engagement: 0,
        content_pieces_processed: 0
      };
    }
  }
}

module.exports = HookGenerator;