/**
 * Marketing Machine - Multi-Model Image Generator
 * Generates branded images for LinkedIn posts using multiple AI models
 */

const OpenAI = require('openai');
const { query, transaction } = require('../../config/database');
const logger = require('../../utils/logger').ai;
const { cache } = require('../../config/redis');
const axios = require('axios');

// Initialize OpenAI for DALL-E
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Multi-Model Image Generator Class
 */
class ImageGenerator {
  constructor() {
    this.supportedModels = ['dall-e-3', 'dall-e-2', 'stable-diffusion', 'midjourney'];
    this.defaultModel = process.env.IMAGE_MODEL || 'dall-e-3';
    this.maxRetries = 2;
    this.imageSizes = {
      'dall-e-3': ['1024x1024', '1792x1024', '1024x1792'],
      'dall-e-2': ['256x256', '512x512', '1024x1024'],
      'stable-diffusion': ['512x512', '768x768', '1024x1024'],
      'midjourney': ['1024x1024', '1792x1024', '1024x1792']
    };
  }

  /**
   * Generate branded images for LinkedIn posts
   * @param {Array} posts - LinkedIn posts to generate images for
   * @param {Object} companyProfile - Company profile with visual style
   * @returns {Promise<Array>} Generated images with metadata
   */
  async generateImages(posts, companyProfile) {
    try {
      logger.info('Starting image generation', {
        postsCount: posts.length,
        companyId: companyProfile.id,
        defaultModel: this.defaultModel
      });

      const generatedImages = [];

      for (const post of posts) {
        try {
          // Generate image prompt from post content
          const imagePrompt = await this.buildImagePrompt(post, companyProfile);
          
          // Check cache first
          const cacheKey = `image:${this.hashContent(imagePrompt + companyProfile.id)}`;
          const cachedImage = await cache.get(cacheKey);
          
          if (cachedImage) {
            logger.info('Using cached image', { postId: post.id, cacheKey });
            generatedImages.push({ ...cachedImage, postId: post.id });
            continue;
          }

          // Generate image with retry logic
          const imageData = await this.generateImageWithModel(imagePrompt, companyProfile, this.defaultModel);
          
          // Process and validate image
          const processedImage = await this.processImage(imageData, post, companyProfile);
          
          // Cache the result
          await cache.set(cacheKey, processedImage, 24 * 60 * 60); // 24 hours
          
          generatedImages.push({ ...processedImage, postId: post.id });

        } catch (error) {
          logger.error('Image generation failed for post', {
            postId: post.id,
            error: error.message
          });
          
          // Generate fallback image or continue without image
          const fallbackImage = await this.generateFallbackImage(post, companyProfile);
          if (fallbackImage) {
            generatedImages.push({ ...fallbackImage, postId: post.id });
          }
        }
      }

      logger.info('Image generation completed', {
        postsProcessed: posts.length,
        imagesGenerated: generatedImages.length,
        companyId: companyProfile.id
      });

      return generatedImages;

    } catch (error) {
      logger.error('Image generation failed', {
        error: error.message,
        stack: error.stack,
        companyId: companyProfile?.id
      });
      throw error;
    }
  }

  /**
   * Build image generation prompt from post content
   * @param {Object} post - LinkedIn post
   * @param {Object} companyProfile - Company profile
   * @returns {Promise<string>} Image prompt
   */
  async buildImagePrompt(post, companyProfile) {
    try {
      const { name, industry, visual_style = {} } = companyProfile;
      const { post_content, hashtags = [] } = post;

      // Use AI to create image prompt from post content
      const promptCreationRequest = `Create a detailed image generation prompt for a LinkedIn post image.

COMPANY CONTEXT:
- Company: ${name}
- Industry: ${industry}
- Visual Style: ${JSON.stringify(visual_style)}

POST CONTENT:
"${post_content}"

HASHTAGS: ${hashtags.join(' ')}

REQUIREMENTS:
1. Professional LinkedIn aesthetic
2. Brand-appropriate colors and style
3. Visual metaphors for the post's key message
4. High-quality, engaging design
5. Include subtle company branding if relevant

VISUAL STYLE PREFERENCES:
- Color Scheme: ${visual_style.primary_colors || 'Professional blue and white'}
- Design Style: ${visual_style.design_style || 'Modern, clean, professional'}
- Typography: ${visual_style.typography || 'Sans-serif, readable'}
- Imagery: ${visual_style.imagery_style || 'Business professional'}

Generate a detailed prompt for ${this.defaultModel} that will create an engaging LinkedIn post image.
The image should be professional, on-brand, and visually support the post's message.

Return only the image generation prompt, nothing else.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: "system",
            content: "You are an expert visual designer who creates detailed prompts for AI image generation. Focus on professional LinkedIn aesthetics."
          },
          {
            role: "user", 
            content: promptCreationRequest
          }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      const imagePrompt = response.choices[0].message.content.trim();
      
      // Add technical specifications
      const enhancedPrompt = `${imagePrompt}

Technical specifications:
- High resolution, professional quality
- LinkedIn post image format
- Clean composition with good contrast
- Suitable for business social media
- ${visual_style.specific_requirements || 'Modern professional aesthetic'}`;

      logger.info('Image prompt generated', {
        postId: post.id,
        promptLength: enhancedPrompt.length
      });

      return enhancedPrompt;

    } catch (error) {
      logger.error('Image prompt generation failed', { error: error.message, postId: post.id });
      
      // Fallback to simple prompt
      return this.buildSimpleImagePrompt(post, companyProfile);
    }
  }

  /**
   * Generate image using specified model
   * @param {string} prompt - Image generation prompt
   * @param {Object} companyProfile - Company profile
   * @param {string} model - AI model to use
   * @returns {Promise<Object>} Image data
   */
  async generateImageWithModel(prompt, companyProfile, model = 'dall-e-3') {
    try {
      logger.info('Generating image with model', { model, promptLength: prompt.length });

      switch (model) {
        case 'dall-e-3':
        case 'dall-e-2':
          return await this.generateWithDallE(prompt, model);
        
        case 'stable-diffusion':
          return await this.generateWithStableDiffusion(prompt, companyProfile);
        
        case 'midjourney':
          return await this.generateWithMidjourney(prompt, companyProfile);
        
        default:
          throw new Error(`Unsupported image model: ${model}`);
      }

    } catch (error) {
      logger.error('Image generation with model failed', {
        error: error.message,
        model,
        companyId: companyProfile.id
      });

      // Try fallback model if primary fails
      if (model !== 'dall-e-2') {
        logger.info('Attempting fallback to DALL-E 2', { originalModel: model });
        return await this.generateWithDallE(prompt, 'dall-e-2');
      }

      throw error;
    }
  }

  /**
   * Generate image using DALL-E
   * @param {string} prompt - Image prompt
   * @param {string} model - DALL-E model version
   * @returns {Promise<Object>} Image data
   */
  async generateWithDallE(prompt, model = 'dall-e-3') {
    try {
      const size = model === 'dall-e-3' ? '1792x1024' : '1024x1024'; // LinkedIn optimal sizes
      
      const response = await openai.images.generate({
        model: model,
        prompt: prompt,
        n: 1,
        size: size,
        quality: model === 'dall-e-3' ? 'hd' : 'standard',
        style: model === 'dall-e-3' ? 'natural' : undefined
      });

      const imageUrl = response.data[0].url;
      const revisedPrompt = response.data[0].revised_prompt;

      // Download and store image
      const imageData = await this.downloadAndProcessImage(imageUrl);

      return {
        model,
        url: imageUrl,
        size,
        quality: model === 'dall-e-3' ? 'hd' : 'standard',
        revised_prompt: revisedPrompt,
        original_prompt: prompt,
        image_data: imageData,
        metadata: {
          generated_at: new Date().toISOString(),
          model_version: model,
          api_provider: 'openai'
        }
      };

    } catch (error) {
      logger.error('DALL-E generation failed', { error: error.message, model });
      throw error;
    }
  }

  /**
   * Generate image using Stable Diffusion (placeholder for external API)
   * @param {string} prompt - Image prompt
   * @param {Object} companyProfile - Company profile
   * @returns {Promise<Object>} Image data
   */
  async generateWithStableDiffusion(prompt, companyProfile) {
    try {
      // This would integrate with Stability AI API
      // For now, return mock data or throw error
      throw new Error('Stable Diffusion integration not yet implemented');

      // Example implementation:
      /*
      const response = await axios.post('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
        text_prompts: [{ text: prompt }],
        cfg_scale: 7,
        height: 1024,
        width: 1024,
        samples: 1,
        steps: 50
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.STABILITY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        model: 'stable-diffusion',
        image_data: response.data.artifacts[0].base64,
        size: '1024x1024',
        metadata: { generated_at: new Date().toISOString() }
      };
      */

    } catch (error) {
      logger.error('Stable Diffusion generation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate image using Midjourney (placeholder for webhook integration)
   * @param {string} prompt - Image prompt  
   * @param {Object} companyProfile - Company profile
   * @returns {Promise<Object>} Image data
   */
  async generateWithMidjourney(prompt, companyProfile) {
    // Midjourney requires Discord bot integration - placeholder for now
    throw new Error('Midjourney integration not yet implemented');
  }

  /**
   * Download and process image from URL
   * @param {string} imageUrl - Image URL to download
   * @returns {Promise<Object>} Processed image data
   */
  async downloadAndProcessImage(imageUrl) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxContentLength: 10 * 1024 * 1024 // 10MB limit
      });

      const imageBuffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'image/png';

      // Basic image validation
      if (imageBuffer.length === 0) {
        throw new Error('Downloaded image is empty');
      }

      if (imageBuffer.length > 10 * 1024 * 1024) {
        throw new Error('Downloaded image too large');
      }

      return {
        buffer: imageBuffer,
        content_type: contentType,
        size_bytes: imageBuffer.length,
        downloaded_at: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Image download failed', { error: error.message, imageUrl });
      throw error;
    }
  }

  /**
   * Process and validate generated image
   * @param {Object} imageData - Raw image data
   * @param {Object} post - Original post
   * @param {Object} companyProfile - Company profile
   * @returns {Object} Processed image
   */
  async processImage(imageData, post, companyProfile) {
    try {
      // Calculate image quality metrics
      const qualityScore = this.calculateImageQuality(imageData);
      const brandAlignment = this.calculateBrandAlignment(imageData, companyProfile);

      return {
        model: imageData.model,
        url: imageData.url,
        size: imageData.size,
        quality_score: qualityScore,
        brand_alignment: brandAlignment,
        prompt_used: imageData.original_prompt,
        revised_prompt: imageData.revised_prompt,
        image_data: imageData.image_data,
        performance_metrics: {
          predicted_engagement: this.predictImageEngagement(imageData, post),
          accessibility_score: this.calculateAccessibilityScore(imageData),
          brand_consistency: brandAlignment
        },
        metadata: {
          ...imageData.metadata,
          post_id: post.id,
          company_id: companyProfile.id,
          processed_at: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Image processing error', { error: error.message, postId: post.id });
      throw error;
    }
  }

  /**
   * Generate fallback image when primary generation fails
   * @param {Object} post - LinkedIn post
   * @param {Object} companyProfile - Company profile
   * @returns {Promise<Object|null>} Fallback image or null
   */
  async generateFallbackImage(post, companyProfile) {
    try {
      // Simple text-based image prompt as fallback
      const fallbackPrompt = `Professional LinkedIn post image for ${companyProfile.industry} company. 
        Clean, modern design with business aesthetic. Professional color scheme.`;

      return await this.generateWithDallE(fallbackPrompt, 'dall-e-2');

    } catch (error) {
      logger.error('Fallback image generation failed', { error: error.message });
      return null;
    }
  }

  /**
   * Build simple image prompt when AI prompt generation fails
   * @param {Object} post - LinkedIn post
   * @param {Object} companyProfile - Company profile
   * @returns {string} Simple prompt
   */
  buildSimpleImagePrompt(post, companyProfile) {
    const industry = companyProfile.industry || 'Business';
    const colors = companyProfile.visual_style?.primary_colors || 'professional blue';
    
    return `Professional ${industry} LinkedIn post image. Clean modern design, ${colors} color scheme, 
      business aesthetic, high quality, suitable for social media sharing.`;
  }

  /**
   * Calculate image quality score
   * @param {Object} imageData - Image data
   * @returns {number} Quality score (1-10)
   */
  calculateImageQuality(imageData) {
    let score = 5; // Base score

    // Model quality
    if (imageData.model === 'dall-e-3') score += 3;
    else if (imageData.model === 'dall-e-2') score += 2;
    
    // Resolution quality
    if (imageData.size === '1792x1024' || imageData.size === '1024x1792') score += 2;
    else if (imageData.size === '1024x1024') score += 1;

    // HD quality
    if (imageData.quality === 'hd') score += 1;

    return Math.min(10, Math.max(1, score));
  }

  /**
   * Calculate brand alignment score
   * @param {Object} imageData - Image data
   * @param {Object} companyProfile - Company profile
   * @returns {number} Brand alignment score (1-10)
   */
  calculateBrandAlignment(imageData, companyProfile) {
    let score = 5; // Base score

    // Check if revised prompt includes brand elements
    const revisedPrompt = (imageData.revised_prompt || '').toLowerCase();
    const companyName = companyProfile.name?.toLowerCase() || '';
    const industry = companyProfile.industry?.toLowerCase() || '';

    if (revisedPrompt.includes('professional')) score += 1;
    if (revisedPrompt.includes('business')) score += 1;
    if (revisedPrompt.includes(industry)) score += 2;
    if (revisedPrompt.includes('clean') || revisedPrompt.includes('modern')) score += 1;

    return Math.min(10, Math.max(1, score));
  }

  /**
   * Predict image engagement potential
   * @param {Object} imageData - Image data
   * @param {Object} post - Original post
   * @returns {number} Engagement prediction (1-10)
   */
  predictImageEngagement(imageData, post) {
    let score = 5;

    // High quality images typically perform better
    if (imageData.quality === 'hd') score += 2;
    if (imageData.model === 'dall-e-3') score += 1;

    // Optimal LinkedIn image size
    if (imageData.size === '1792x1024') score += 2;

    // Post performance correlation
    if (post.performance_score > 7) score += 1;

    return Math.min(10, Math.max(1, score));
  }

  /**
   * Calculate accessibility score
   * @param {Object} imageData - Image data
   * @returns {number} Accessibility score (1-10)
   */
  calculateAccessibilityScore(imageData) {
    // Basic accessibility scoring based on available data
    let score = 5;

    // High resolution typically means better accessibility
    if (imageData.size === '1792x1024' || imageData.size === '1024x1024') score += 2;
    if (imageData.quality === 'hd') score += 1;

    // Professional prompts typically create more accessible images
    const prompt = (imageData.revised_prompt || '').toLowerCase();
    if (prompt.includes('professional') || prompt.includes('clean')) score += 1;
    if (prompt.includes('contrast') || prompt.includes('readable')) score += 1;

    return Math.min(10, Math.max(1, score));
  }

  /**
   * Store generated images in database
   * @param {Array} images - Generated images
   * @param {Array} posts - Original posts
   * @param {number} companyId - Company ID
   * @returns {Promise<Array>} Stored images with IDs
   */
  async storeImages(images, posts, companyId) {
    try {
      const storedImages = [];

      await transaction(async (client) => {
        for (const image of images) {
          const result = await client.query(`
            INSERT INTO post_images (
              company_id,
              linkedin_post_id,
              model_used,
              image_url,
              image_size,
              quality_score,
              brand_alignment_score,
              prompt_used,
              revised_prompt,
              status,
              metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'generated', $10)
            RETURNING *
          `, [
            companyId,
            image.postId,
            image.model,
            image.url,
            image.size,
            image.quality_score,
            image.brand_alignment,
            image.prompt_used,
            image.revised_prompt || null,
            JSON.stringify({
              ...image.metadata,
              performance_metrics: image.performance_metrics
            })
          ]);

          storedImages.push(result.rows[0]);
        }
      });

      logger.info('Images stored successfully', {
        count: storedImages.length,
        companyId
      });

      return storedImages;

    } catch (error) {
      logger.error('Error storing images', {
        error: error.message,
        imagesCount: images.length,
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
   * Get image generation statistics
   * @param {number} companyId - Company ID
   * @returns {Promise<Object>} Statistics
   */
  async getStats(companyId) {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_images,
          AVG(quality_score) as avg_quality,
          AVG(brand_alignment_score) as avg_brand_alignment,
          COUNT(DISTINCT model_used) as models_used,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count
        FROM post_images
        WHERE company_id = $1
      `, [companyId]);

      return {
        total_images: parseInt(result.rows[0].total_images),
        avg_quality: parseFloat(result.rows[0].avg_quality || 0).toFixed(1),
        avg_brand_alignment: parseFloat(result.rows[0].avg_brand_alignment || 0).toFixed(1),
        models_used: parseInt(result.rows[0].models_used),
        approved_count: parseInt(result.rows[0].approved_count)
      };

    } catch (error) {
      logger.error('Error getting image stats', { error: error.message, companyId });
      return {
        total_images: 0,
        avg_quality: 0,
        avg_brand_alignment: 0,
        models_used: 0,
        approved_count: 0
      };
    }
  }
}

module.exports = ImageGenerator;