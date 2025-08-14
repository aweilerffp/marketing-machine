-- Marketing Machine Database Schema
-- Comprehensive schema for automated LinkedIn content creation

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================
-- CORE TABLES
-- =============================================

-- Companies table
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    website VARCHAR(255),
    industry VARCHAR(100),
    description TEXT,
    
    -- ICP (Ideal Customer Profile)
    icp JSONB,
    
    -- Brand voice and content strategy
    brand_voice JSONB,
    content_pillars JSONB,
    visual_style JSONB,
    
    -- Settings
    settings JSONB DEFAULT '{}',
    
    -- Status
    status VARCHAR(50) DEFAULT 'active',
    subscription_tier VARCHAR(50) DEFAULT 'free',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    
    -- Role and permissions
    role VARCHAR(50) DEFAULT 'user', -- admin, manager, user
    permissions JSONB DEFAULT '{}',
    
    -- OAuth tokens (LinkedIn, etc.)
    oauth_tokens JSONB DEFAULT '{}',
    
    -- Settings
    preferences JSONB DEFAULT '{}',
    
    -- Status
    status VARCHAR(50) DEFAULT 'active',
    email_verified BOOLEAN DEFAULT FALSE,
    last_login_at TIMESTAMP,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- CONTENT INPUT TABLES
-- =============================================

-- Content sources (webhooks, manual input, file uploads)
CREATE TABLE content_sources (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Source information
    source_type VARCHAR(50) NOT NULL, -- webhook, manual, upload
    source_name VARCHAR(100), -- read.ai, zoom, manual_input
    
    -- Content
    title VARCHAR(255),
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'meeting_transcript', -- meeting_transcript, blog_post, notes, etc.
    
    -- Metadata
    metadata JSONB DEFAULT '{}', -- meeting_date, participants, file_info, etc.
    
    -- Processing
    processed BOOLEAN DEFAULT FALSE,
    processing_started_at TIMESTAMP,
    processing_completed_at TIMESTAMP,
    processing_error TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- KNOWLEDGE MANAGEMENT
-- =============================================

-- Company knowledge base
CREATE TABLE company_knowledge (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Knowledge type and content
    knowledge_type VARCHAR(50) NOT NULL, -- website_copy, marketing_emails, product_docs, etc.
    title VARCHAR(255),
    content TEXT NOT NULL,
    
    -- AI processing
    summary TEXT,
    keywords TEXT[], -- Array of extracted keywords
    embedding_vector FLOAT8[], -- For vector similarity search
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    source_url VARCHAR(500),
    
    -- Status
    status VARCHAR(50) DEFAULT 'active',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- PROCESSING PIPELINE TABLES
-- =============================================

-- Processing batches (groups related content processing)
CREATE TABLE processing_batches (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    content_source_id INTEGER REFERENCES content_sources(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
    
    -- Progress
    total_steps INTEGER DEFAULT 4, -- hooks, posts, images, approval
    current_step INTEGER DEFAULT 0,
    step_details JSONB DEFAULT '{}',
    
    -- Timing
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    estimated_completion TIMESTAMP,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Marketing hooks (extracted insights)
CREATE TABLE marketing_hooks (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    processing_batch_id INTEGER REFERENCES processing_batches(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Hook content
    hook_text TEXT NOT NULL,
    hook_type VARCHAR(50), -- pain_point, success_metric, industry_insight, etc.
    content_pillar VARCHAR(100),
    
    -- Generated variations
    linkedin_hook TEXT, -- 150 words
    tweet_version TEXT, -- 280 chars
    blog_title TEXT,
    
    -- Source context
    source_quote TEXT,
    source_context TEXT,
    
    -- Scoring
    relevance_score FLOAT DEFAULT 0,
    engagement_potential FLOAT DEFAULT 0,
    priority INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(50) DEFAULT 'ready', -- ready, used, archived
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- CONTENT GENERATION TABLES
-- =============================================

-- Generated LinkedIn posts
CREATE TABLE linkedin_posts (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    marketing_hook_id INTEGER REFERENCES marketing_hooks(id) ON DELETE CASCADE,
    processing_batch_id INTEGER REFERENCES processing_batches(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Post content
    title VARCHAR(255),
    content TEXT NOT NULL,
    
    -- LinkedIn optimization
    character_count INTEGER,
    reading_level FLOAT,
    hashtags TEXT[],
    mentions TEXT[],
    
    -- AI generation details
    model_used VARCHAR(50) DEFAULT 'gpt-4',
    prompt_version VARCHAR(50),
    generation_cost DECIMAL(10,4),
    
    -- Quality metrics
    linkedin_score FLOAT, -- Algorithm optimization score
    brand_consistency_score FLOAT,
    engagement_prediction FLOAT,
    
    -- Status and approval
    status VARCHAR(50) DEFAULT 'draft', -- draft, pending_approval, approved, rejected, published
    approval_status VARCHAR(50) DEFAULT 'pending',
    approval_notes TEXT,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    
    -- Publishing
    scheduled_for TIMESTAMP,
    published_at TIMESTAMP,
    platform_post_id VARCHAR(255),
    
    -- Performance (populated after publishing)
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,2) DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- IMAGE GENERATION TABLES
-- =============================================

-- Image generation requests and results
CREATE TABLE generated_images (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    linkedin_post_id INTEGER REFERENCES linkedin_posts(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Image details
    prompt TEXT NOT NULL,
    alt_text VARCHAR(200),
    
    -- AI model information
    model_used VARCHAR(50) NOT NULL, -- dalle-3, stable-diffusion, midjourney
    model_version VARCHAR(50),
    generation_cost DECIMAL(10,4),
    
    -- Generated image
    image_url VARCHAR(500),
    image_data BYTEA, -- Store image binary data
    image_metadata JSONB DEFAULT '{}', -- dimensions, format, etc.
    
    -- Brand compliance
    brand_score FLOAT DEFAULT 0,
    visual_style_match FLOAT DEFAULT 0,
    
    -- Status
    status VARCHAR(50) DEFAULT 'generated', -- generating, generated, approved, rejected
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- PUBLISHING AND SCHEDULING
-- =============================================

-- Publishing queue
CREATE TABLE publishing_queue (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    linkedin_post_id INTEGER REFERENCES linkedin_posts(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Scheduling
    scheduled_for TIMESTAMP NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Platform details
    platform VARCHAR(50) DEFAULT 'linkedin',
    platform_account_id VARCHAR(255),
    
    -- Queue status
    status VARCHAR(50) DEFAULT 'queued', -- queued, processing, published, failed
    
    -- Publishing result
    platform_post_id VARCHAR(255),
    platform_response JSONB,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    published_at TIMESTAMP
);

-- =============================================
-- ANALYTICS AND PERFORMANCE
-- =============================================

-- Performance analytics
CREATE TABLE post_analytics (
    id SERIAL PRIMARY KEY,
    linkedin_post_id INTEGER REFERENCES linkedin_posts(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Platform data
    platform VARCHAR(50) DEFAULT 'linkedin',
    platform_post_id VARCHAR(255),
    
    -- Metrics
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    
    -- Calculated metrics
    engagement_rate DECIMAL(5,2) DEFAULT 0,
    click_through_rate DECIMAL(5,2) DEFAULT 0,
    
    -- Timing
    measured_at TIMESTAMP DEFAULT NOW(),
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================
-- WEBHOOK MANAGEMENT
-- =============================================

-- Webhook configurations
CREATE TABLE webhook_configs (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Webhook details
    name VARCHAR(100) NOT NULL,
    webhook_url VARCHAR(500) NOT NULL,
    source_type VARCHAR(50) NOT NULL, -- read.ai, zoom, otter, custom
    
    -- Security
    secret_key VARCHAR(255),
    signature_header VARCHAR(100),
    
    -- Configuration
    payload_mapping JSONB, -- How to extract content from different formats
    filters JSONB, -- Conditions for processing
    
    -- Status
    status VARCHAR(50) DEFAULT 'active',
    last_received_at TIMESTAMP,
    total_received INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Webhook delivery log
CREATE TABLE webhook_deliveries (
    id SERIAL PRIMARY KEY,
    webhook_config_id INTEGER REFERENCES webhook_configs(id) ON DELETE CASCADE,
    content_source_id INTEGER REFERENCES content_sources(id) ON DELETE SET NULL,
    
    -- Delivery details
    payload JSONB NOT NULL,
    headers JSONB,
    
    -- Processing
    status VARCHAR(50) DEFAULT 'received', -- received, processed, failed
    processing_result JSONB,
    error_message TEXT,
    
    -- Timing
    received_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

-- =============================================
-- INDICES FOR PERFORMANCE
-- =============================================

-- Companies
CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_companies_subscription ON companies(subscription_tier);

-- Users  
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_status ON users(status);

-- Content sources
CREATE INDEX idx_content_sources_company ON content_sources(company_id);
CREATE INDEX idx_content_sources_type ON content_sources(source_type);
CREATE INDEX idx_content_sources_processed ON content_sources(processed);
CREATE INDEX idx_content_sources_created ON content_sources(created_at);

-- Processing batches
CREATE INDEX idx_processing_batches_status ON processing_batches(status);
CREATE INDEX idx_processing_batches_company ON processing_batches(company_id);
CREATE INDEX idx_processing_batches_created ON processing_batches(created_at);

-- Marketing hooks
CREATE INDEX idx_marketing_hooks_batch ON marketing_hooks(processing_batch_id);
CREATE INDEX idx_marketing_hooks_priority ON marketing_hooks(priority);
CREATE INDEX idx_marketing_hooks_status ON marketing_hooks(status);

-- LinkedIn posts
CREATE INDEX idx_linkedin_posts_status ON linkedin_posts(status);
CREATE INDEX idx_linkedin_posts_approval ON linkedin_posts(approval_status);
CREATE INDEX idx_linkedin_posts_scheduled ON linkedin_posts(scheduled_for);
CREATE INDEX idx_linkedin_posts_company ON linkedin_posts(company_id);

-- Publishing queue
CREATE INDEX idx_publishing_queue_scheduled ON publishing_queue(scheduled_for);
CREATE INDEX idx_publishing_queue_status ON publishing_queue(status);
CREATE INDEX idx_publishing_queue_company ON publishing_queue(company_id);

-- Knowledge base search
CREATE INDEX idx_company_knowledge_company ON company_knowledge(company_id);
CREATE INDEX idx_company_knowledge_type ON company_knowledge(knowledge_type);
CREATE INDEX idx_company_knowledge_content_gin ON company_knowledge USING GIN(to_tsvector('english', content));

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_sources_updated_at BEFORE UPDATE ON content_sources 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_knowledge_updated_at BEFORE UPDATE ON company_knowledge 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processing_batches_updated_at BEFORE UPDATE ON processing_batches 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketing_hooks_updated_at BEFORE UPDATE ON marketing_hooks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_linkedin_posts_updated_at BEFORE UPDATE ON linkedin_posts 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- INITIAL DATA
-- =============================================

-- Insert default company for testing
INSERT INTO companies (name, website, industry, description, icp, brand_voice, content_pillars, status) 
VALUES (
    'Marketing Machine Demo',
    'https://marketingmachine.ai',
    'SaaS',
    'Automated LinkedIn content creation from meeting recordings',
    '{"job_titles": ["Marketing Manager", "Content Creator", "CMO"], "company_size": "50-500", "pain_points": ["Time-consuming content creation", "Inconsistent posting", "Low engagement"], "goals": ["Increase LinkedIn presence", "Generate leads", "Build thought leadership"]}',
    '{"tone": ["professional", "helpful", "data-driven"], "keywords": ["automation", "efficiency", "ROI", "LinkedIn"], "prohibited_terms": ["revolutionary", "game-changing", "disruption"]}',
    '[{"title": "Product Innovation", "description": "Latest features and improvements", "keywords": ["features", "updates", "innovation"]}, {"title": "Industry Insights", "description": "Market trends and analysis", "keywords": ["trends", "analysis", "insights"]}, {"title": "Customer Success", "description": "Success stories and case studies", "keywords": ["success", "results", "ROI"]}]',
    'active'
);

-- Insert demo user
INSERT INTO users (company_id, email, first_name, last_name, role, status, email_verified) 
VALUES (
    1,
    'demo@marketingmachine.ai', 
    'Demo',
    'User',
    'admin',
    'active',
    true
);