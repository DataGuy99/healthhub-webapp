-- Table: budget_settings
-- Description: Global budget period settings for all budget categories

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

-- Ensure one budget setting per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_budget_settings_user_id ON budget_settings(user_id);

-- Row Level Security
ALTER TABLE budget_settings ENABLE ROW LEVEL SECURITY;

-- Policies: budget_settings
CREATE POLICY "Users can view their own budget settings"
  ON budget_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budget settings"
  ON budget_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budget settings"
  ON budget_settings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budget settings"
  ON budget_settings
  FOR DELETE
  USING (auth.uid() = user_id);
