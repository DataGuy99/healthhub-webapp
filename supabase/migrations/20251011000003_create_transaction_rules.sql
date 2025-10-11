-- Transaction mapping rules for CSV imports
-- Allows users to train the system to recognize merchants/keywords

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

ALTER TABLE transaction_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transaction rules" ON transaction_rules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own transaction rules" ON transaction_rules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own transaction rules" ON transaction_rules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own transaction rules" ON transaction_rules FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_transaction_rules_updated_at BEFORE UPDATE ON transaction_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
