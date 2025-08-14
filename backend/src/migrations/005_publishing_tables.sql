-- Marketing Machine - Publishing System Tables
-- Phase 7: Smart Publishing System

-- Publishing history table
CREATE TABLE IF NOT EXISTS publishing_history (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES linkedin_posts(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL, -- 'scheduled', 'published', 'cancelled', 'failed'
  linkedin_post_id VARCHAR(255),
  linkedin_post_url TEXT,
  scheduled_time TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX idx_publishing_history_post (post_id),
  INDEX idx_publishing_history_company (company_id),
  INDEX idx_publishing_history_action (action),
  INDEX idx_publishing_history_created (created_at)
);

-- Add publishing-related columns to linkedin_posts if not exists
ALTER TABLE linkedin_posts 
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP,
ADD COLUMN IF NOT EXISTS scheduled_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS published_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS linkedin_post_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS linkedin_post_url TEXT,
ADD COLUMN IF NOT EXISTS linkedin_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS publishing_error TEXT,
ADD COLUMN IF NOT EXISTS last_modified_by INTEGER REFERENCES users(id);

-- Add indexes for publishing queries
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_scheduled_for ON linkedin_posts(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_published_at ON linkedin_posts(published_at);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_status_scheduled ON linkedin_posts(status, scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_company_status ON linkedin_posts(company_id, status);
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_linkedin_post_id ON linkedin_posts(linkedin_post_id);

-- Add LinkedIn integration columns to companies if not exists
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS linkedin_access_token TEXT,
ADD COLUMN IF NOT EXISTS linkedin_page_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS linkedin_token_expires TIMESTAMP,
ADD COLUMN IF NOT EXISTS optimal_posting_times JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS publishing_preferences JSONB DEFAULT '{}';

-- Update post status enum to include publishing statuses
-- Note: This would need to be done carefully in production
-- For now, we'll handle this in the application logic

-- Performance optimization: Add partial indexes for common queries
CREATE INDEX IF NOT EXISTS idx_linkedin_posts_pending_approval 
ON linkedin_posts(company_id, created_at) 
WHERE status = 'pending_approval';

CREATE INDEX IF NOT EXISTS idx_linkedin_posts_scheduled 
ON linkedin_posts(company_id, scheduled_for) 
WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_linkedin_posts_published_recent 
ON linkedin_posts(company_id, published_at) 
WHERE status = 'published' AND published_at >= NOW() - INTERVAL '90 days';

-- Comments for documentation
COMMENT ON TABLE publishing_history IS 'Tracks all publishing-related actions and events';
COMMENT ON COLUMN linkedin_posts.scheduled_for IS 'When the post is scheduled to be published';
COMMENT ON COLUMN linkedin_posts.published_at IS 'When the post was actually published';
COMMENT ON COLUMN linkedin_posts.linkedin_post_id IS 'LinkedIn platform post ID';
COMMENT ON COLUMN linkedin_posts.linkedin_metrics IS 'JSON object containing LinkedIn engagement metrics';
COMMENT ON COLUMN companies.linkedin_access_token IS 'Encrypted LinkedIn API access token';
COMMENT ON COLUMN companies.optimal_posting_times IS 'AI-calculated optimal posting schedule for this company';