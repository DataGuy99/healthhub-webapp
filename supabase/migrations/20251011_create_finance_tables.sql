-- Finance Module Database Migration
-- Created: 2025-10-11
-- Purpose: Add finance tracking with Plaid integration, custom categories, and transaction itemization

-- ============================================================================
-- 1. BANK ACCOUNTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plaid_access_token TEXT NOT NULL,
  plaid_item_id TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  institution_id TEXT,
  account_name TEXT,
  account_mask TEXT,
  account_type TEXT, -- checking, savings, credit, etc.
  account_subtype TEXT,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, plaid_item_id)
);

-- Index for faster user queries
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_active ON bank_accounts(user_id, is_active);

-- ============================================================================
-- 2. BUDGET CATEGORIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS budget_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT, -- emoji or icon identifier
  color TEXT, -- hex color for UI
  parent_category_id UUID REFERENCES budget_categories(id) ON DELETE CASCADE,
  is_system BOOLEAN DEFAULT false, -- system categories can't be deleted
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_budget_categories_user_id ON budget_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_categories_parent ON budget_categories(parent_category_id);

-- ============================================================================
-- 3. TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE CASCADE,
  plaid_transaction_id TEXT,

  -- Transaction details
  amount DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  timestamp TIMESTAMPTZ,
  merchant TEXT,
  description TEXT,

  -- Categorization
  category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
  auto_categorized BOOLEAN DEFAULT false,

  -- Recurring detection
  is_recurring BOOLEAN DEFAULT false,
  recurring_series_id UUID, -- groups recurring transactions

  -- User notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, plaid_transaction_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_bank_account ON transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_recurring ON transactions(recurring_series_id) WHERE recurring_series_id IS NOT NULL;

-- ============================================================================
-- 4. TRANSACTION ITEMS TABLE (for itemized receipts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS transaction_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Item details
  name TEXT NOT NULL,
  pretax_amount DECIMAL(10,2) NOT NULL,
  quantity DECIMAL(10,3) DEFAULT 1,
  unit_price DECIMAL(10,2),

  -- Per-item category
  category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_user ON transaction_items(user_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_category ON transaction_items(category_id);

-- ============================================================================
-- 5. BUDGET GOALS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS budget_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES budget_categories(id) ON DELETE CASCADE,

  -- Goal details
  name TEXT NOT NULL,
  target_amount DECIMAL(10,2) NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'yearly')),

  -- Date range
  start_date DATE NOT NULL,
  end_date DATE,

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_budget_goals_user_id ON budget_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_goals_category ON budget_goals(category_id);
CREATE INDEX IF NOT EXISTS idx_budget_goals_active ON budget_goals(user_id, is_active);

-- ============================================================================
-- 6. PLAID SYNC CURSOR TABLE (for incremental syncs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS plaid_sync_cursors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  cursor TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bank_account_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_plaid_sync_cursors_account ON plaid_sync_cursors(bank_account_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE plaid_sync_cursors ENABLE ROW LEVEL SECURITY;

-- Bank Accounts Policies
CREATE POLICY "Users can view their own bank accounts"
  ON bank_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bank accounts"
  ON bank_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bank accounts"
  ON bank_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bank accounts"
  ON bank_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- Budget Categories Policies
CREATE POLICY "Users can view their own categories"
  ON budget_categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own categories"
  ON budget_categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categories"
  ON budget_categories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own non-system categories"
  ON budget_categories FOR DELETE
  USING (auth.uid() = user_id AND is_system = false);

-- Transactions Policies
CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = user_id);

-- Transaction Items Policies
CREATE POLICY "Users can view their own transaction items"
  ON transaction_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transaction items"
  ON transaction_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transaction items"
  ON transaction_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transaction items"
  ON transaction_items FOR DELETE
  USING (auth.uid() = user_id);

-- Budget Goals Policies
CREATE POLICY "Users can view their own goals"
  ON budget_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals"
  ON budget_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
  ON budget_goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
  ON budget_goals FOR DELETE
  USING (auth.uid() = user_id);

-- Plaid Sync Cursors Policies
CREATE POLICY "Users can view their own sync cursors"
  ON plaid_sync_cursors FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sync cursors"
  ON plaid_sync_cursors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sync cursors"
  ON plaid_sync_cursors FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS FOR AUTO-UPDATING updated_at TIMESTAMPS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budget_categories_updated_at
  BEFORE UPDATE ON budget_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transaction_items_updated_at
  BEFORE UPDATE ON transaction_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_budget_goals_updated_at
  BEFORE UPDATE ON budget_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DEFAULT BUDGET CATEGORIES
-- ============================================================================

-- Note: These will be inserted per-user via application logic on first use
-- to allow user_id foreign key constraint to work properly

-- Example categories structure:
-- - Groceries (icon: 🛒, color: #10b981)
-- - Auto (icon: 🚗, color: #3b82f6)
--   - Auto - Gas (parent: Auto)
--   - Auto - Insurance (parent: Auto)
--   - Auto - Maintenance (parent: Auto)
-- - Rent (icon: 🏠, color: #8b5cf6)
-- - Supplements (icon: 💊, color: #ec4899)
-- - Bills (icon: 📄, color: #f59e0b)
--   - Bills - Utilities (parent: Bills)
--   - Bills - Subscriptions (parent: Bills)
-- - Shopping (icon: 🛍️, color: #06b6d4)
-- - Investments (icon: 📈, color: #14b8a6)
-- - Other (icon: 📦, color: #6b7280)

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
