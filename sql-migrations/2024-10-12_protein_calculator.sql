-- Table: protein_calculations
-- Description: Store protein cost calculations for grocery items

CREATE TABLE IF NOT EXISTS protein_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  serving_size DECIMAL(10, 2) NOT NULL,
  serving_unit TEXT NOT NULL,
  protein_grams DECIMAL(10, 2) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  cost_per_gram DECIMAL(10, 6) NOT NULL, -- Calculated: price / protein_grams
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: protein_targets
-- Description: Store user's target protein cost and tolerance

CREATE TABLE IF NOT EXISTS protein_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_cost_per_gram DECIMAL(10, 6) NOT NULL, -- Target cost per gram of protein
  tolerance_percentage DECIMAL(5, 2) NOT NULL, -- Acceptable % over target (e.g., 15 for 15%)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_protein_calculations_user_id ON protein_calculations(user_id);
CREATE INDEX IF NOT EXISTS idx_protein_calculations_date ON protein_calculations(date);
CREATE INDEX IF NOT EXISTS idx_protein_calculations_cost_per_gram ON protein_calculations(cost_per_gram);

CREATE INDEX IF NOT EXISTS idx_protein_targets_user_id ON protein_targets(user_id);

-- Row Level Security
ALTER TABLE protein_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE protein_targets ENABLE ROW LEVEL SECURITY;

-- Policies: protein_calculations
CREATE POLICY "Users can view their own protein calculations"
  ON protein_calculations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own protein calculations"
  ON protein_calculations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own protein calculations"
  ON protein_calculations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policies: protein_targets
CREATE POLICY "Users can view their own protein targets"
  ON protein_targets
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own protein targets"
  ON protein_targets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own protein targets"
  ON protein_targets
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own protein targets"
  ON protein_targets
  FOR DELETE
  USING (auth.uid() = user_id);
