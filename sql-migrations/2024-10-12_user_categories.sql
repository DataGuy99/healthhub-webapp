-- Table: user_categories
-- Description: Store user-created custom categories for dynamic tab management

CREATE TABLE IF NOT EXISTS user_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL, -- URL-safe identifier
  icon TEXT NOT NULL DEFAULT '📁',
  color TEXT NOT NULL, -- Tailwind gradient classes
  template TEXT NOT NULL CHECK (template IN ('checklist', 'spending', 'events', 'investments', 'custom')),
  "order" INTEGER NOT NULL DEFAULT 0, -- Display order
  is_active BOOLEAN DEFAULT true,
  sub_tabs JSONB, -- Array of sub-tab configurations
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_categories_user_id ON user_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_categories_slug ON user_categories(slug);
CREATE INDEX IF NOT EXISTS idx_user_categories_order ON user_categories("order");
CREATE INDEX IF NOT EXISTS idx_user_categories_is_active ON user_categories(is_active);

-- Unique constraint: One slug per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_categories_user_slug
  ON user_categories(user_id, slug);

-- Row Level Security
ALTER TABLE user_categories ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own categories
CREATE POLICY "Users can view their own categories"
  ON user_categories
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own categories
CREATE POLICY "Users can insert their own categories"
  ON user_categories
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own categories
CREATE POLICY "Users can update their own categories"
  ON user_categories
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own categories
CREATE POLICY "Users can delete their own categories"
  ON user_categories
  FOR DELETE
  USING (auth.uid() = user_id);
