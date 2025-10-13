-- Table: recurring_bills
-- Description: Store recurring bill definitions (rent, utilities, subscriptions, etc.)

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recurring_bills_user_id ON recurring_bills(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_bills_is_active ON recurring_bills(is_active);

-- Row Level Security
ALTER TABLE recurring_bills ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own bills
CREATE POLICY "Users can view their own recurring bills"
  ON recurring_bills
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own bills
CREATE POLICY "Users can insert their own recurring bills"
  ON recurring_bills
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own bills
CREATE POLICY "Users can update their own recurring bills"
  ON recurring_bills
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own bills
CREATE POLICY "Users can delete their own recurring bills"
  ON recurring_bills
  FOR DELETE
  USING (auth.uid() = user_id);
