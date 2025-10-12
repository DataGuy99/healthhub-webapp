-- Table: bill_payments
-- Description: Track individual bill payment instances (paid/unpaid status)

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bill_payments_user_id ON bill_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_recurring_bill_id ON bill_payments(recurring_bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_date ON bill_payments(date);
CREATE INDEX IF NOT EXISTS idx_bill_payments_paid ON bill_payments(paid);

-- Unique constraint: One payment record per bill per date
CREATE UNIQUE INDEX IF NOT EXISTS idx_bill_payments_unique
  ON bill_payments(recurring_bill_id, date);

-- Row Level Security
ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own payments
CREATE POLICY "Users can view their own bill payments"
  ON bill_payments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own payments
CREATE POLICY "Users can insert their own bill payments"
  ON bill_payments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own payments
CREATE POLICY "Users can update their own bill payments"
  ON bill_payments
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own payments
CREATE POLICY "Users can delete their own bill payments"
  ON bill_payments
  FOR DELETE
  USING (auth.uid() = user_id);
