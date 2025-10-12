-- ============================================================================
-- COMPLETE HEALTHHUB DATABASE SCHEMA
-- ============================================================================
-- This will DROP all existing tables and recreate them from scratch
-- WARNING: This will DELETE ALL YOUR DATA!
-- Only run this if you want to start fresh or are setting up for the first time
-- ============================================================================

-- Drop existing tables (in correct order due to foreign key constraints)
DROP TABLE IF EXISTS supplement_logs CASCADE;
DROP TABLE IF EXISTS supplements CASCADE;
DROP TABLE IF EXISTS supplement_sections CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SUPPLEMENTS TABLE
-- ============================================================================
CREATE TABLE supplements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dose TEXT,
  dose_unit TEXT,
  ingredients JSONB,
  form TEXT,
  section TEXT,
  active_days JSONB,
  frequency_pattern TEXT DEFAULT 'everyday' CHECK (frequency_pattern IN ('everyday', '5/2', 'workout', 'custom')),
  is_stack BOOLEAN DEFAULT false,
  stack_id UUID REFERENCES supplements(id) ON DELETE SET NULL,
  "order" INTEGER DEFAULT 0,
  cost DECIMAL(10,2) CHECK (cost IS NULL OR cost >= 0),
  quantity INTEGER CHECK (quantity IS NULL OR quantity >= 0),
  frequency INTEGER DEFAULT 1 CHECK (frequency IS NULL OR frequency >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SUPPLEMENT LOGS TABLE
-- ============================================================================
CREATE TABLE supplement_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id UUID NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_taken BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, supplement_id, date)
);

-- ============================================================================
-- SUPPLEMENT SECTIONS TABLE
-- ============================================================================
CREATE TABLE supplement_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_supplements_user ON supplements(user_id);
CREATE INDEX idx_supplements_section ON supplements(section);
CREATE INDEX idx_supplement_logs_user ON supplement_logs(user_id);
CREATE INDEX idx_supplement_logs_date ON supplement_logs(date);
CREATE INDEX idx_supplement_logs_supplement ON supplement_logs(supplement_id);
CREATE INDEX idx_supplement_sections_user ON supplement_sections(user_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
ALTER TABLE supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplement_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplement_sections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SUPPLEMENTS POLICIES
-- ============================================================================
CREATE POLICY "Users can view their own supplements"
  ON supplements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own supplements"
  ON supplements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own supplements"
  ON supplements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own supplements"
  ON supplements FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SUPPLEMENT LOGS POLICIES
-- ============================================================================
CREATE POLICY "Users can view their own logs"
  ON supplement_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own logs"
  ON supplement_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own logs"
  ON supplement_logs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own logs"
  ON supplement_logs FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- SUPPLEMENT SECTIONS POLICIES
-- ============================================================================
CREATE POLICY "Users can view their own sections"
  ON supplement_sections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sections"
  ON supplement_sections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sections"
  ON supplement_sections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sections"
  ON supplement_sections FOR DELETE
  USING (auth.uid() = user_id);
