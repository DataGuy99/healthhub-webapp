-- ============================================================================
-- HEALTHHUB COMPLETE DATABASE SCHEMA
-- ============================================================================
-- Consolidated from all migration files - 2025-10-13
-- This file contains ALL tables needed for the HealthHub application
-- Run this in Supabase SQL Editor - safe to run multiple times (idempotent)
-- ============================================================================

-- ============================================================================
-- CLEANUP: DROP ALL EXISTING TABLES (CASCADE DROPS POLICIES, INDEXES, TRIGGERS)
-- ============================================================================
-- Drop all tables in order (dependent tables first)
-- CASCADE automatically drops dependent objects (policies, indexes, triggers, foreign keys)

DROP TABLE IF EXISTS plaid_sync_cursors CASCADE;
DROP TABLE IF EXISTS budget_goals CASCADE;
DROP TABLE IF EXISTS transaction_items CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS budget_categories CASCADE;
DROP TABLE IF EXISTS bank_accounts CASCADE;
DROP TABLE IF EXISTS user_categories CASCADE;
DROP TABLE IF EXISTS maintenance_items CASCADE;
DROP TABLE IF EXISTS gas_fillups CASCADE;
DROP TABLE IF EXISTS misc_shop_purchases CASCADE;
DROP TABLE IF EXISTS misc_shop_budgets CASCADE;
DROP TABLE IF EXISTS protein_calculations CASCADE;
DROP TABLE IF EXISTS protein_targets CASCADE;
DROP TABLE IF EXISTS grocery_purchases CASCADE;
DROP TABLE IF EXISTS grocery_budgets CASCADE;
DROP TABLE IF EXISTS transaction_rules CASCADE;
DROP TABLE IF EXISTS bill_payments CASCADE;
DROP TABLE IF EXISTS recurring_bills CASCADE;
DROP TABLE IF EXISTS budget_settings CASCADE;
DROP TABLE IF EXISTS category_budgets CASCADE;
DROP TABLE IF EXISTS category_logs CASCADE;
DROP TABLE IF EXISTS category_items CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS supplement_sections CASCADE;
DROP TABLE IF EXISTS supplement_logs CASCADE;
DROP TABLE IF EXISTS supplements CASCADE;

-- ============================================================================
-- HELPER FUNCTION FOR AUTO-UPDATING updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. SUPPLEMENTS MODULE (from 2024-10-11_complete_database.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE TABLE IF NOT EXISTS supplement_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id UUID NOT NULL REFERENCES supplements(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_taken BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, supplement_id, date)
);

CREATE TABLE IF NOT EXISTS supplement_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_supplements_user ON supplements(user_id);
CREATE INDEX IF NOT EXISTS idx_supplements_section ON supplements(section);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_user ON supplement_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_date ON supplement_logs(date);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_supplement ON supplement_logs(supplement_id);
CREATE INDEX IF NOT EXISTS idx_supplement_sections_user ON supplement_sections(user_id);

-- ============================================================================
-- 2. USER SETTINGS (from 20251011_create_finance_tables.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_auto_log_time TIME DEFAULT '00:00:00',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- ============================================================================
-- 3. CATEGORY SYSTEM (from 2024-10-11_category_tables.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS category_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(10,2),
  frequency TEXT,
  subcategory TEXT,
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category, name)
);

CREATE TABLE IF NOT EXISTS category_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_item_id UUID NOT NULL REFERENCES category_items(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  actual_amount DECIMAL(10,2),
  notes TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  is_planned BOOLEAN DEFAULT true,
  UNIQUE(user_id, category_item_id, date)
);

CREATE TABLE IF NOT EXISTS category_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  month_year TEXT NOT NULL,
  target_amount DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category, month_year)
);

CREATE INDEX IF NOT EXISTS idx_category_items_user ON category_items(user_id);
CREATE INDEX IF NOT EXISTS idx_category_items_category ON category_items(user_id, category);
CREATE INDEX IF NOT EXISTS idx_category_items_active ON category_items(user_id, category, is_active);
CREATE INDEX IF NOT EXISTS idx_category_logs_user ON category_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_category_logs_item ON category_logs(category_item_id);
CREATE INDEX IF NOT EXISTS idx_category_logs_date ON category_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_category_budgets_user ON category_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_category_budgets_category ON category_budgets(user_id, category);
CREATE INDEX IF NOT EXISTS idx_category_budgets_month ON category_budgets(user_id, month_year);

-- ============================================================================
-- 4. BUDGET & BILL SETTINGS (from 2024-10-12_budget_settings.sql, recurring_bills.sql, bill_payments.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS budget_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'biweekly', 'monthly', 'custom')),
  period_start_day INTEGER CHECK (period_start_day >= 0 AND period_start_day <= 31),
  period_start_date DATE,
  period_length_days INTEGER CHECK (period_length_days > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_settings_user_id ON budget_settings(user_id);

CREATE TABLE IF NOT EXISTS recurring_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'custom')),
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
  skip_first_week BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  color TEXT,
  icon TEXT DEFAULT '💵',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recurring_bill_id UUID NOT NULL REFERENCES recurring_bills(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_bills_user_id ON recurring_bills(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_bills_is_active ON recurring_bills(is_active);
CREATE INDEX IF NOT EXISTS idx_bill_payments_user_id ON bill_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_recurring_bill_id ON bill_payments(recurring_bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_date ON bill_payments(date);
CREATE INDEX IF NOT EXISTS idx_bill_payments_paid ON bill_payments(paid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bill_payments_unique ON bill_payments(recurring_bill_id, date);

-- ============================================================================
-- 5. TRANSACTION RULES (from 2024-10-11_transaction_rules.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS transaction_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  category TEXT NOT NULL,
  template TEXT NOT NULL CHECK (template IN ('market', 'covenant', 'chronicle', 'treasury')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, keyword)
);

CREATE INDEX IF NOT EXISTS idx_transaction_rules_user ON transaction_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_rules_keyword ON transaction_rules(user_id, keyword);

-- ============================================================================
-- 6. GROCERY MODULE (from 2024-10-12_grocery_budget.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS grocery_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_budget DECIMAL(10, 2) NOT NULL DEFAULT 90.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS grocery_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grocery_budgets_user_id ON grocery_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_grocery_purchases_user_id ON grocery_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_grocery_purchases_date ON grocery_purchases(date);

-- ============================================================================
-- 7. PROTEIN CALCULATOR (from 2024-10-12_protein_calculator.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS protein_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  serving_size DECIMAL(10, 2) NOT NULL,
  serving_unit TEXT NOT NULL,
  protein_grams DECIMAL(10, 2) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  cost_per_gram DECIMAL(10, 6) NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS protein_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_cost_per_gram DECIMAL(10, 6) NOT NULL,
  tolerance_percentage DECIMAL(5, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_protein_calculations_user_id ON protein_calculations(user_id);
CREATE INDEX IF NOT EXISTS idx_protein_calculations_date ON protein_calculations(date);
CREATE INDEX IF NOT EXISTS idx_protein_calculations_cost_per_gram ON protein_calculations(cost_per_gram);
CREATE INDEX IF NOT EXISTS idx_protein_targets_user_id ON protein_targets(user_id);

-- ============================================================================
-- 8. MISC SHOP MODULE (from 2024-10-12_misc_shop.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS misc_shop_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_budget DECIMAL(10, 2) NOT NULL DEFAULT 30.00,
  rollover_savings DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS misc_shop_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  is_big_purchase BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_misc_shop_budgets_user_id ON misc_shop_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_misc_shop_purchases_user_id ON misc_shop_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_misc_shop_purchases_date ON misc_shop_purchases(date);

-- ============================================================================
-- 9. AUTO MODULE (from 2024-10-12_auto_tracker.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS gas_fillups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  mileage INTEGER NOT NULL,
  gallons DECIMAL(10, 2) NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  price_per_gallon DECIMAL(10, 3) NOT NULL,
  mpg DECIMAL(10, 2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenance_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  interval_miles INTEGER NOT NULL,
  last_done_mileage INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  icon TEXT DEFAULT '🔧',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gas_fillups_user_id ON gas_fillups(user_id);
CREATE INDEX IF NOT EXISTS idx_gas_fillups_date ON gas_fillups(date);
CREATE INDEX IF NOT EXISTS idx_gas_fillups_mileage ON gas_fillups(mileage);
CREATE INDEX IF NOT EXISTS idx_maintenance_items_user_id ON maintenance_items(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_items_is_active ON maintenance_items(is_active);

-- ============================================================================
-- 10. USER CATEGORIES (from 2024-10-12_user_categories.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📁',
  color TEXT NOT NULL,
  template TEXT NOT NULL CHECK (template IN ('checklist', 'spending', 'events', 'investments', 'custom')),
  "order" INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  sub_tabs JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_categories_user_id ON user_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_categories_slug ON user_categories(slug);
CREATE INDEX IF NOT EXISTS idx_user_categories_order ON user_categories("order");
CREATE INDEX IF NOT EXISTS idx_user_categories_is_active ON user_categories(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_categories_user_slug ON user_categories(user_id, slug);

-- ============================================================================
-- 11. BANK/PLAID INTEGRATION (from 20251011_create_finance_tables.sql)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_access_token TEXT NOT NULL,
  plaid_item_id TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  institution_id TEXT,
  account_name TEXT,
  account_mask TEXT,
  account_type TEXT,
  account_subtype TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plaid_item_id)
);

CREATE TABLE IF NOT EXISTS budget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  parent_category_id UUID REFERENCES budget_categories(id) ON DELETE CASCADE,
  is_system BOOLEAN DEFAULT false,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE CASCADE,
  plaid_transaction_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  timestamp TIMESTAMPTZ,
  merchant TEXT,
  description TEXT,
  category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
  auto_categorized BOOLEAN DEFAULT false,
  is_recurring BOOLEAN DEFAULT false,
  recurring_series_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plaid_transaction_id)
);

CREATE TABLE IF NOT EXISTS transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pretax_amount DECIMAL(10,2) NOT NULL,
  quantity DECIMAL(10,3) DEFAULT 1,
  unit_price DECIMAL(10,2),
  category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES budget_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount DECIMAL(10,2) NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plaid_sync_cursors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  cursor TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bank_account_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_active ON bank_accounts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_budget_categories_user_id ON budget_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_categories_parent ON budget_categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_bank_account ON transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_recurring ON transactions(recurring_series_id) WHERE recurring_series_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_user ON transaction_items(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_category ON transaction_items(category_id);
CREATE INDEX IF NOT EXISTS idx_budget_goals_user_id ON budget_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_goals_category ON budget_goals(category_id);
CREATE INDEX IF NOT EXISTS idx_budget_goals_active ON budget_goals(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_plaid_sync_cursors_account ON plaid_sync_cursors(bank_account_id);

-- ============================================================================
-- 12. PERFORMANCE INDEXES (from 2024-10-12_performance_indexes.sql)
-- ============================================================================

-- Additional composite indexes for optimal query performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_grocery_budgets_user ON grocery_budgets(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_protein_targets_user ON protein_targets(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_misc_shop_budgets_user ON misc_shop_budgets(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplement_logs_unique ON supplement_logs(user_id, supplement_id, date);
CREATE INDEX IF NOT EXISTS idx_gas_fillups_user_date_mileage ON gas_fillups(user_id, date DESC, mileage DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_items_user_active ON maintenance_items(user_id, is_active, service_name);
CREATE INDEX IF NOT EXISTS idx_recurring_bills_user_active ON recurring_bills(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bill_payments_user_date ON bill_payments(user_id, date);
CREATE INDEX IF NOT EXISTS idx_grocery_purchases_user_date ON grocery_purchases(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_protein_calculations_user_created ON protein_calculations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_misc_shop_purchases_user_date ON misc_shop_purchases(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_supplements_user_section_order ON supplements(user_id, section, "order");
CREATE INDEX IF NOT EXISTS idx_supplement_logs_user_date ON supplement_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_supplement_sections_user_order ON supplement_sections(user_id, "order");
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_active ON bank_accounts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_category_logs_user_date ON category_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_category_logs_category_item ON category_logs(category_item_id);
CREATE INDEX IF NOT EXISTS idx_category_budgets_user_month ON category_budgets(user_id, month_year);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================

ALTER TABLE supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplement_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplement_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE protein_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE protein_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE misc_shop_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE misc_shop_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE gas_fillups ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_sync_cursors ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES (Standard pattern for all tables)
-- ============================================================================

-- Supplements
CREATE POLICY "Users can view their own supplements" ON supplements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own supplements" ON supplements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own supplements" ON supplements FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own supplements" ON supplements FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own logs" ON supplement_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own logs" ON supplement_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own logs" ON supplement_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own logs" ON supplement_logs FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own sections" ON supplement_sections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own sections" ON supplement_sections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sections" ON supplement_sections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own sections" ON supplement_sections FOR DELETE USING (auth.uid() = user_id);

-- User Settings
CREATE POLICY "Users can view their own settings" ON user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own settings" ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own settings" ON user_settings FOR UPDATE USING (auth.uid() = user_id);

-- Category System
CREATE POLICY "Users can view their own category items" ON category_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own category items" ON category_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own category items" ON category_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own category items" ON category_items FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own category logs" ON category_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own category logs" ON category_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own category logs" ON category_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own category logs" ON category_logs FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own category budgets" ON category_budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own category budgets" ON category_budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own category budgets" ON category_budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own category budgets" ON category_budgets FOR DELETE USING (auth.uid() = user_id);

-- Budget & Bills
CREATE POLICY "Users can view their own budget settings" ON budget_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own budget settings" ON budget_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own budget settings" ON budget_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own budget settings" ON budget_settings FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own recurring bills" ON recurring_bills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own recurring bills" ON recurring_bills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own recurring bills" ON recurring_bills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own recurring bills" ON recurring_bills FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own bill payments" ON bill_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own bill payments" ON bill_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bill payments" ON bill_payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own bill payments" ON bill_payments FOR DELETE USING (auth.uid() = user_id);

-- Transaction Rules
CREATE POLICY "Users can view their own transaction rules" ON transaction_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own transaction rules" ON transaction_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own transaction rules" ON transaction_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own transaction rules" ON transaction_rules FOR DELETE USING (auth.uid() = user_id);

-- Grocery
CREATE POLICY "Users can view their own grocery budgets" ON grocery_budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own grocery budgets" ON grocery_budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own grocery budgets" ON grocery_budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own grocery budgets" ON grocery_budgets FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own grocery purchases" ON grocery_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own grocery purchases" ON grocery_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own grocery purchases" ON grocery_purchases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own grocery purchases" ON grocery_purchases FOR DELETE USING (auth.uid() = user_id);

-- Protein
CREATE POLICY "Users can view their own protein calculations" ON protein_calculations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own protein calculations" ON protein_calculations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own protein calculations" ON protein_calculations FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own protein targets" ON protein_targets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own protein targets" ON protein_targets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own protein targets" ON protein_targets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own protein targets" ON protein_targets FOR DELETE USING (auth.uid() = user_id);

-- Misc Shop
CREATE POLICY "Users can view their own misc shop budgets" ON misc_shop_budgets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own misc shop budgets" ON misc_shop_budgets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own misc shop budgets" ON misc_shop_budgets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own misc shop budgets" ON misc_shop_budgets FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own misc shop purchases" ON misc_shop_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own misc shop purchases" ON misc_shop_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own misc shop purchases" ON misc_shop_purchases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own misc shop purchases" ON misc_shop_purchases FOR DELETE USING (auth.uid() = user_id);

-- Auto
CREATE POLICY "Users can view their own gas fillups" ON gas_fillups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own gas fillups" ON gas_fillups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own gas fillups" ON gas_fillups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own gas fillups" ON gas_fillups FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own maintenance items" ON maintenance_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own maintenance items" ON maintenance_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own maintenance items" ON maintenance_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own maintenance items" ON maintenance_items FOR DELETE USING (auth.uid() = user_id);

-- User Categories
CREATE POLICY "Users can view their own categories" ON user_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own categories" ON user_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own categories" ON user_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own categories" ON user_categories FOR DELETE USING (auth.uid() = user_id);

-- Bank/Plaid
CREATE POLICY "Users can view their own bank accounts" ON bank_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own bank accounts" ON bank_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bank accounts" ON bank_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own bank accounts" ON bank_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own categories" ON budget_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own categories" ON budget_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own categories" ON budget_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own non-system categories" ON budget_categories FOR DELETE USING (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can view their own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own transaction items" ON transaction_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own transaction items" ON transaction_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own transaction items" ON transaction_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own transaction items" ON transaction_items FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own goals" ON budget_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own goals" ON budget_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own goals" ON budget_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own goals" ON budget_goals FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own sync cursors" ON plaid_sync_cursors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own sync cursors" ON plaid_sync_cursors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own sync cursors" ON plaid_sync_cursors FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS FOR AUTO-UPDATING updated_at
-- ============================================================================

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_category_items_updated_at BEFORE UPDATE ON category_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_category_budgets_updated_at BEFORE UPDATE ON category_budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_budget_settings_updated_at BEFORE UPDATE ON budget_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recurring_bills_updated_at BEFORE UPDATE ON recurring_bills FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bill_payments_updated_at BEFORE UPDATE ON bill_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transaction_rules_updated_at BEFORE UPDATE ON transaction_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_grocery_budgets_updated_at BEFORE UPDATE ON grocery_budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_protein_targets_updated_at BEFORE UPDATE ON protein_targets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_misc_shop_budgets_updated_at BEFORE UPDATE ON misc_shop_budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_categories_updated_at BEFORE UPDATE ON user_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON bank_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_budget_categories_updated_at BEFORE UPDATE ON budget_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transaction_items_updated_at BEFORE UPDATE ON transaction_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_budget_goals_updated_at BEFORE UPDATE ON budget_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETE - TOTAL 25 TABLES
-- ============================================================================
-- To apply: Copy this entire file and paste into Supabase SQL Editor, then Run
-- ============================================================================
