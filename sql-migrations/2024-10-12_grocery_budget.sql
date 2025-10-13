-- Table: grocery_budgets
-- Description: Store user's grocery budget settings
-- Note: Period settings (week start day, etc.) are now managed globally in budget_settings table

CREATE TABLE IF NOT EXISTS grocery_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weekly_budget DECIMAL(10, 2) NOT NULL DEFAULT 90.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Table: grocery_purchases
-- Description: Track individual grocery shopping trips

CREATE TABLE IF NOT EXISTS grocery_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_grocery_budgets_user_id ON grocery_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_grocery_purchases_user_id ON grocery_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_grocery_purchases_date ON grocery_purchases(date);

-- Row Level Security
ALTER TABLE grocery_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_purchases ENABLE ROW LEVEL SECURITY;

-- Policies: grocery_budgets
CREATE POLICY "Users can view their own grocery budgets"
  ON grocery_budgets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own grocery budgets"
  ON grocery_budgets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own grocery budgets"
  ON grocery_budgets
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own grocery budgets"
  ON grocery_budgets
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policies: grocery_purchases
CREATE POLICY "Users can view their own grocery purchases"
  ON grocery_purchases
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own grocery purchases"
  ON grocery_purchases
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own grocery purchases"
  ON grocery_purchases
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own grocery purchases"
  ON grocery_purchases
  FOR DELETE
  USING (auth.uid() = user_id);
