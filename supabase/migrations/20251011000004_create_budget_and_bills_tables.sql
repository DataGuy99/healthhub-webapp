-- Budget Settings and Bills Migration
-- Created: 2025-10-12
-- Purpose: Add budget period settings and recurring bills tracking

-- ============================================================================
-- 1. BUDGET SETTINGS TABLE
-- ============================================================================
-- Global budget period settings for all budget categories
CREATE TABLE IF NOT EXISTS budget_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'biweekly', 'monthly', 'custom')),
  period_start_day INTEGER CHECK (period_start_day >= 0 AND period_start_day <= 31),
  period_start_date DATE,
  period_length_days INTEGER CHECK (period_length_days > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_budget_settings_user_id ON budget_settings(user_id);

-- ============================================================================
-- 2. RECURRING BILLS TABLE
-- ============================================================================
-- Store recurring bill definitions (rent, utilities, subscriptions, etc.)
CREATE TABLE IF NOT EXISTS recurring_bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'custom')),
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
  day_of_month INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
  skip_first_week BOOLEAN DEFAULT false, -- For rent: skip first week of month
  is_active BOOLEAN DEFAULT true,
  color TEXT,
  icon TEXT DEFAULT '💵',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recurring_bills_user_id ON recurring_bills(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_bills_is_active ON recurring_bills(is_active);

-- ============================================================================
-- 3. BILL PAYMENTS TABLE
-- ============================================================================
-- Track individual bill payment instances (paid/unpaid status)
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
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(recurring_bill_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bill_payments_user_id ON bill_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_recurring_bill_id ON bill_payments(recurring_bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_date ON bill_payments(date);
CREATE INDEX IF NOT EXISTS idx_bill_payments_paid ON bill_payments(paid);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE budget_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;

-- Budget Settings Policies
CREATE POLICY "Users can view their own budget settings"
  ON budget_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budget settings"
  ON budget_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budget settings"
  ON budget_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budget settings"
  ON budget_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Recurring Bills Policies
CREATE POLICY "Users can view their own recurring bills"
  ON recurring_bills FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recurring bills"
  ON recurring_bills FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recurring bills"
  ON recurring_bills FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recurring bills"
  ON recurring_bills FOR DELETE
  USING (auth.uid() = user_id);

-- Bill Payments Policies
CREATE POLICY "Users can view their own bill payments"
  ON bill_payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bill payments"
  ON bill_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bill payments"
  ON bill_payments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bill payments"
  ON bill_payments FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS FOR AUTO-UPDATING updated_at TIMESTAMPS
-- ============================================================================

CREATE TRIGGER update_budget_settings_updated_at
  BEFORE UPDATE ON budget_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_bills_updated_at
  BEFORE UPDATE ON recurring_bills
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bill_payments_updated_at
  BEFORE UPDATE ON bill_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
