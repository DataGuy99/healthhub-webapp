-- Table: misc_shop_budgets
-- Description: Store user's misc shop budget and rollover savings
-- Note: Period settings are now managed globally in budget_settings table

CREATE TABLE IF NOT EXISTS misc_shop_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_budget DECIMAL(10, 2) NOT NULL DEFAULT 30.00,
  rollover_savings DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Table: misc_shop_purchases
-- Description: Track misc shop purchases

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_misc_shop_budgets_user_id ON misc_shop_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_misc_shop_purchases_user_id ON misc_shop_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_misc_shop_purchases_date ON misc_shop_purchases(date);

-- Row Level Security
ALTER TABLE misc_shop_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE misc_shop_purchases ENABLE ROW LEVEL SECURITY;

-- Policies: misc_shop_budgets
CREATE POLICY "Users can view their own misc shop budgets"
  ON misc_shop_budgets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own misc shop budgets"
  ON misc_shop_budgets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own misc shop budgets"
  ON misc_shop_budgets
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own misc shop budgets"
  ON misc_shop_budgets
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policies: misc_shop_purchases
CREATE POLICY "Users can view their own misc shop purchases"
  ON misc_shop_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own misc shop purchases"
  ON misc_shop_purchases
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own misc shop purchases"
  ON misc_shop_purchases
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own misc shop purchases"
  ON misc_shop_purchases
  FOR DELETE
  USING (auth.uid() = user_id);
