/**
 * Marketing Machine - Image Generator Tests
 */

const ImageGenerator = require('../src/services/ai/imageGenerator');

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Professional LinkedIn image with modern design, blue color scheme, business aesthetic, high quality'
            }
          }]
        })
      }
    },
    images: {
      generate: jest.fn().mockResolvedValue({
        data: [{
          url: 'https://example.com/generated-image.png',
          revised_prompt: 'A professional business image with modern design elements'
        }]
      })
    }
  }));
});

// Mock axios for image download
jest.mock('axios', () => ({
  get: jest.fn().mockResolvedValue({
    data: Buffer.from('fake-image-data'),
    headers: { 'content-type': 'image/png' }
  })
}));

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

describe('ImageGenerator', () => {
  let imageGenerator;
  let mockPost;
  let mockCompanyProfile;

  beforeEach(() => {
    imageGenerator = new ImageGenerator();
    
    mockPost = {
      id: 1,
      post_content: "🚀 We just saved 20 hours per week with automation. Here's how we transformed our sales process and increased productivity by 300%.",
      hashtags: ['#Automation', '#Productivity', '#Sales'],
      performance_score: 8
    };

    mockCompanyProfile = {
      id: 1,
      name: "TechCorp Inc",
      industry: "Technology",
      visual_style: {
        primary_colors: "professional blue and white",
        design_style: "modern, clean, professional",
        typography: "sans-serif, readable",
        imagery_style: "business professional"
      }
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('generateImages', () => {
    it('should generate images for posts', async () => {
      const posts = [mockPost];
      const result = await imageGenerator.generateImages(posts, mockCompanyProfile);

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('postId', 1);
      expect(result[0]).toHaveProperty('model');
      expect(result[0]).toHaveProperty('url');
      expect(result[0]).toHaveProperty('quality_score');
    });

    it('should handle empty posts array', async () => {
      const result = await imageGenerator.generateImages([], mockCompanyProfile);
      expect(result).toHaveLength(0);
    });

    it('should continue processing even if one image fails', async () => {
      const posts = [
        mockPost,
        { ...mockPost, id: 2, post_content: "Another post" }
      ];

      // Mock one failure
      const mockGenerate = require('openai')().images.generate;
      mockGenerate
        .mockResolvedValueOnce({
          data: [{
            url: 'https://example.com/image1.png',
            revised_prompt: 'Success prompt'
          }]
        })
        .mockRejectedValueOnce(new Error('Generation failed'));

      const result = await imageGenerator.generateImages(posts, mockCompanyProfile);
      expect(result).toHaveLength(1); // Only successful one
    });
  });

  describe('buildImagePrompt', () => {
    it('should build image prompt from post content', async () => {
      const prompt = await imageGenerator.buildImagePrompt(mockPost, mockCompanyProfile);
      
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(50);
    });

    it('should fall back to simple prompt if AI fails', async () => {
      const mockCreate = require('openai')().chat.completions.create;
      mockCreate.mockRejectedValueOnce(new Error('AI prompt generation failed'));
      
      const prompt = await imageGenerator.buildImagePrompt(mockPost, mockCompanyProfile);
      expect(prompt).toContain('Technology');
      expect(prompt).toContain('professional');
    });
  });

  describe('generateWithDallE', () => {
    it('should generate image with DALL-E 3', async () => {
      const prompt = 'Professional business image';
      const result = await imageGenerator.generateWithDallE(prompt, 'dall-e-3');

      expect(result.model).toBe('dall-e-3');
      expect(result.url).toBe('https://example.com/generated-image.png');
      expect(result.size).toBe('1792x1024');
      expect(result.quality).toBe('hd');
    });

    it('should generate image with DALL-E 2', async () => {
      const prompt = 'Professional business image';
      const result = await imageGenerator.generateWithDallE(prompt, 'dall-e-2');

      expect(result.model).toBe('dall-e-2');
      expect(result.size).toBe('1024x1024');
      expect(result.quality).toBe('standard');
    });

    it('should handle OpenAI API errors', async () => {
      const mockGenerate = require('openai')().images.generate;
      mockGenerate.mockRejectedValueOnce(new Error('API Error'));

      await expect(
        imageGenerator.generateWithDallE('test prompt', 'dall-e-3')
      ).rejects.toThrow('API Error');
    });
  });

  describe('generateImageWithModel', () => {
    it('should use DALL-E by default', async () => {
      const result = await imageGenerator.generateImageWithModel(
        'test prompt',
        mockCompanyProfile,
        'dall-e-3'
      );

      expect(result.model).toBe('dall-e-3');
    });

    it('should fallback to DALL-E 2 on failure', async () => {
      const mockGenerate = require('openai')().images.generate;
      mockGenerate
        .mockRejectedValueOnce(new Error('DALL-E 3 failed'))
        .mockResolvedValueOnce({
          data: [{
            url: 'https://example.com/fallback.png',
            revised_prompt: 'Fallback prompt'
          }]
        });

      const result = await imageGenerator.generateImageWithModel(
        'test prompt',
        mockCompanyProfile,
        'dall-e-3'
      );

      expect(result.model).toBe('dall-e-2');
    });

    it('should reject unsupported models', async () => {
      await expect(
        imageGenerator.generateImageWithModel('test', mockCompanyProfile, 'unsupported-model')
      ).rejects.toThrow('Unsupported image model: unsupported-model');
    });
  });

  describe('downloadAndProcessImage', () => {
    it('should download and process image', async () => {
      const result = await imageGenerator.downloadAndProcessImage('https://example.com/image.png');

      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.content_type).toBe('image/png');
      expect(result.size_bytes).toBeGreaterThan(0);
    });

    it('should validate image size', async () => {
      const axios = require('axios');
      axios.get.mockResolvedValueOnce({
        data: Buffer.alloc(0), // Empty buffer
        headers: { 'content-type': 'image/png' }
      });

      await expect(
        imageGenerator.downloadAndProcessImage('https://example.com/empty.png')
      ).rejects.toThrow('Downloaded image is empty');
    });
  });

  describe('processImage', () => {
    it('should process and validate generated image', async () => {
      const mockImageData = {
        model: 'dall-e-3',
        url: 'https://example.com/image.png',
        size: '1792x1024',
        quality: 'hd',
        original_prompt: 'test prompt',
        revised_prompt: 'revised prompt',
        image_data: { buffer: Buffer.from('test'), content_type: 'image/png' },
        metadata: { generated_at: new Date().toISOString() }
      };

      const result = await imageGenerator.processImage(mockImageData, mockPost, mockCompanyProfile);

      expect(result.model).toBe('dall-e-3');
      expect(result.quality_score).toBeGreaterThanOrEqual(1);
      expect(result.quality_score).toBeLessThanOrEqual(10);
      expect(result.brand_alignment).toBeGreaterThanOrEqual(1);
      expect(result.performance_metrics).toBeDefined();
    });
  });

  describe('calculateImageQuality', () => {
    it('should give higher scores to DALL-E 3 HD images', () => {
      const highQualityImage = {
        model: 'dall-e-3',
        size: '1792x1024',
        quality: 'hd'
      };

      const lowQualityImage = {
        model: 'dall-e-2',
        size: '512x512',
        quality: 'standard'
      };

      const highScore = imageGenerator.calculateImageQuality(highQualityImage);
      const lowScore = imageGenerator.calculateImageQuality(lowQualityImage);

      expect(highScore).toBeGreaterThan(lowScore);
      expect(highScore).toBeLessThanOrEqual(10);
      expect(lowScore).toBeGreaterThanOrEqual(1);
    });
  });

  describe('calculateBrandAlignment', () => {
    it('should calculate brand alignment score', () => {
      const mockImageData = {
        revised_prompt: 'Professional business technology image with modern clean design'
      };

      const score = imageGenerator.calculateBrandAlignment(mockImageData, mockCompanyProfile);
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(10);
    });

    it('should give higher scores for industry-relevant prompts', () => {
      const techImage = {
        revised_prompt: 'Professional technology business image with modern design'
      };

      const genericImage = {
        revised_prompt: 'Generic image with basic design'
      };

      const techScore = imageGenerator.calculateBrandAlignment(techImage, mockCompanyProfile);
      const genericScore = imageGenerator.calculateBrandAlignment(genericImage, mockCompanyProfile);

      expect(techScore).toBeGreaterThan(genericScore);
    });
  });

  describe('predictImageEngagement', () => {
    it('should predict engagement based on image quality', () => {
      const highQualityImage = {
        quality: 'hd',
        model: 'dall-e-3',
        size: '1792x1024'
      };

      const score = imageGenerator.predictImageEngagement(highQualityImage, mockPost);
      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(10);
    });
  });

  describe('storeImages', () => {
    it('should store images in database', async () => {
      const mockImages = [{
        postId: 1,
        model: 'dall-e-3',
        url: 'https://example.com/image.png',
        size: '1792x1024',
        quality_score: 8,
        brand_alignment: 7,
        prompt_used: 'test prompt',
        metadata: { generated_at: new Date().toISOString() }
      }];

      const result = await imageGenerator.storeImages(mockImages, [mockPost], 1);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('id', 1);
    });
  });

  describe('hashContent', () => {
    it('should generate consistent hashes', () => {
      const content = "test content for hashing";
      const hash1 = imageGenerator.hashContent(content);
      const hash2 = imageGenerator.hashContent(content);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(16);
    });

    it('should generate different hashes for different content', () => {
      const hash1 = imageGenerator.hashContent("content1");
      const hash2 = imageGenerator.hashContent("content2");
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateFallbackImage', () => {
    it('should generate simple fallback image', async () => {
      const result = await imageGenerator.generateFallbackImage(mockPost, mockCompanyProfile);
      
      expect(result.model).toBe('dall-e-2');
      expect(result.url).toBeDefined();
    });

    it('should return null if fallback fails', async () => {
      const mockGenerate = require('openai')().images.generate;
      mockGenerate.mockRejectedValueOnce(new Error('All generation failed'));

      const result = await imageGenerator.generateFallbackImage(mockPost, mockCompanyProfile);
      expect(result).toBeNull();
    });
  });

  describe('buildSimpleImagePrompt', () => {
    it('should build simple prompt with company info', () => {
      const prompt = imageGenerator.buildSimpleImagePrompt(mockPost, mockCompanyProfile);
      
      expect(prompt).toContain('Technology');
      expect(prompt).toContain('professional blue');
      expect(prompt).toContain('LinkedIn');
    });
  });
});