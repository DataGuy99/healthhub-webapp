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

CREATE INDEX IF NOT EXISTS idx_category_items_user ON category_items(user_id);
CREATE INDEX IF NOT EXISTS idx_category_items_category ON category_items(user_id, category);
CREATE INDEX IF NOT EXISTS idx_category_items_active ON category_items(user_id, category, is_active);

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

CREATE INDEX IF NOT EXISTS idx_category_logs_user ON category_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_category_logs_item ON category_logs(category_item_id);
CREATE INDEX IF NOT EXISTS idx_category_logs_date ON category_logs(user_id, date DESC);

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

CREATE INDEX IF NOT EXISTS idx_category_budgets_user ON category_budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_category_budgets_category ON category_budgets(user_id, category);
CREATE INDEX IF NOT EXISTS idx_category_budgets_month ON category_budgets(user_id, month_year);

ALTER TABLE category_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_budgets ENABLE ROW LEVEL SECURITY;

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

CREATE TRIGGER update_category_items_updated_at BEFORE UPDATE ON category_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_category_budgets_updated_at BEFORE UPDATE ON category_budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
