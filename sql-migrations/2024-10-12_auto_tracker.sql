-- Table: gas_fillups
-- Description: Track gas purchases and calculate MPG

CREATE TABLE IF NOT EXISTS gas_fillups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  mileage INTEGER NOT NULL,
  gallons DECIMAL(10, 2) NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  price_per_gallon DECIMAL(10, 3) NOT NULL,
  mpg DECIMAL(10, 2), -- Calculated from previous fillup
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: maintenance_items
-- Description: Track vehicle maintenance schedule and alerts

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_gas_fillups_user_id ON gas_fillups(user_id);
CREATE INDEX IF NOT EXISTS idx_gas_fillups_date ON gas_fillups(date);
CREATE INDEX IF NOT EXISTS idx_gas_fillups_mileage ON gas_fillups(mileage);

CREATE INDEX IF NOT EXISTS idx_maintenance_items_user_id ON maintenance_items(user_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_items_is_active ON maintenance_items(is_active);

-- Row Level Security
ALTER TABLE gas_fillups ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_items ENABLE ROW LEVEL SECURITY;

-- Policies: gas_fillups
CREATE POLICY "Users can view their own gas fillups"
  ON gas_fillups
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own gas fillups"
  ON gas_fillups
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own gas fillups"
  ON gas_fillups
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own gas fillups"
  ON gas_fillups
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policies: maintenance_items
CREATE POLICY "Users can view their own maintenance items"
  ON maintenance_items
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own maintenance items"
  ON maintenance_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own maintenance items"
  ON maintenance_items
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own maintenance items"
  ON maintenance_items
  FOR DELETE
  USING (auth.uid() = user_id);
