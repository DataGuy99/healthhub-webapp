-- Complete Supabase Schema for HealtHub
-- Run this entire file in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SUPPLEMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS supplements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dose TEXT,
  dose_unit TEXT,
  ingredients JSONB,
  form TEXT,
  section TEXT,
  active_days JSONB,
  is_stack BOOLEAN DEFAULT false,
  stack_id UUID,
  "order" INTEGER DEFAULT 0,
  cost DECIMAL(10,2),
  quantity INTEGER,
  frequency INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SUPPLEMENT LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS supplement_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id UUID NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  is_taken BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, supplement_id, date)
);

-- ============================================================================
-- SUPPLEMENT SECTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS supplement_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_supplements_user ON supplements(user_id);
CREATE INDEX IF NOT EXISTS idx_supplements_section ON supplements(section);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_user ON supplement_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_date ON supplement_logs(date);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_supplement ON supplement_logs(supplement_id);
CREATE INDEX IF NOT EXISTS idx_supplement_sections_user ON supplement_sections(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplement_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplement_sections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SUPPLEMENTS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own supplements" ON supplements;
CREATE POLICY "Users can view their own supplements"
  ON supplements FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own supplements" ON supplements;
CREATE POLICY "Users can insert their own supplements"
  ON supplements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own supplements" ON supplements;
CREATE POLICY "Users can update their own supplements"
  ON supplements FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own supplements" ON supplements;
CREATE POLICY "Users can delete their own supplements"
  ON supplements FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SUPPLEMENT LOGS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own logs" ON supplement_logs;
CREATE POLICY "Users can view their own logs"
  ON supplement_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own logs" ON supplement_logs;
CREATE POLICY "Users can insert their own logs"
  ON supplement_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own logs" ON supplement_logs;
CREATE POLICY "Users can update their own logs"
  ON supplement_logs FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own logs" ON supplement_logs;
CREATE POLICY "Users can delete their own logs"
  ON supplement_logs FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SUPPLEMENT SECTIONS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view their own sections" ON supplement_sections;
CREATE POLICY "Users can view their own sections"
  ON supplement_sections FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own sections" ON supplement_sections;
CREATE POLICY "Users can insert their own sections"
  ON supplement_sections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sections" ON supplement_sections;
CREATE POLICY "Users can update their own sections"
  ON supplement_sections FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sections" ON supplement_sections;
CREATE POLICY "Users can delete their own sections"
  ON supplement_sections FOR DELETE
  USING (auth.uid() = user_id);
