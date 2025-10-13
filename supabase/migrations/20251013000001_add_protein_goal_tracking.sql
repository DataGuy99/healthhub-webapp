-- Protein Goal Tracking Migration
-- Created: 2025-10-13
-- Purpose: Add daily protein goal and purchase-level protein tracking to grocery system

-- ============================================================================
-- 1. UPDATE GROCERY_BUDGETS TABLE
-- ============================================================================
-- Add daily protein goal column
ALTER TABLE grocery_budgets
ADD COLUMN IF NOT EXISTS daily_protein_goal DECIMAL(10,2) DEFAULT 0.00;

-- ============================================================================
-- 2. UPDATE GROCERY_PURCHASES TABLE
-- ============================================================================
-- Add protein tracking fields to purchases
ALTER TABLE grocery_purchases
ADD COLUMN IF NOT EXISTS protein_grams DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS days_covered DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS is_protein_source BOOLEAN DEFAULT false;

COMMENT ON COLUMN grocery_purchases.protein_grams IS 'Total protein grams in this purchase';
COMMENT ON COLUMN grocery_purchases.days_covered IS 'How many days of protein this covers';
COMMENT ON COLUMN grocery_purchases.is_protein_source IS 'Flag to indicate this is primarily a protein purchase';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
