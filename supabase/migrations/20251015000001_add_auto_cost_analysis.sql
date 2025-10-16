-- Migration: Add automotive cost-per-mile analysis
-- Created: 2025-10-15
-- Purpose: Track comprehensive vehicle cost analysis including maintenance and fuel

-- Add cost-per-mile tracking columns to existing tables
ALTER TABLE gas_fillups
ADD COLUMN IF NOT EXISTS cost_per_mile_at_fillup NUMERIC(10,4);

COMMENT ON COLUMN gas_fillups.cost_per_mile_at_fillup IS
'Calculated cost per mile at time of fillup (snapshot for historical analysis)';

ALTER TABLE maintenance_items
ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(10,2) DEFAULT 0.00;

COMMENT ON COLUMN maintenance_items.estimated_cost IS
'Estimated or typical cost for this maintenance item';

-- Create comprehensive cost analysis table
CREATE TABLE IF NOT EXISTS auto_cost_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    analysis_period_start DATE NOT NULL,
    analysis_period_end DATE NOT NULL,
    total_miles_driven NUMERIC(10,2) NOT NULL,
    total_maintenance_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    total_fuel_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    average_mpg NUMERIC(10,2) NOT NULL,
    average_gas_price NUMERIC(10,3) NOT NULL,
    -- Generated column with safe division handling
    cost_per_mile NUMERIC(10,4) GENERATED ALWAYS AS (
        CASE
            WHEN total_miles_driven > 0
            THEN (total_maintenance_cost + total_fuel_cost) / total_miles_driven
            ELSE NULL
        END
    ) STORED,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT non_negative_miles CHECK (total_miles_driven >= 0),
    CONSTRAINT non_negative_maintenance CHECK (total_maintenance_cost >= 0),
    CONSTRAINT non_negative_fuel CHECK (total_fuel_cost >= 0),
    CONSTRAINT valid_mpg CHECK (average_mpg > 0),
    CONSTRAINT non_negative_price CHECK (average_gas_price >= 0),
    CONSTRAINT valid_period CHECK (analysis_period_end >= analysis_period_start),
    CONSTRAINT unique_user_period UNIQUE (user_id, analysis_period_start, analysis_period_end)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_auto_cost_user_period
ON auto_cost_analysis (user_id, analysis_period_start DESC);

CREATE INDEX IF NOT EXISTS idx_auto_cost_user_date
ON auto_cost_analysis (user_id, analysis_period_end DESC);

-- Enable Row Level Security
ALTER TABLE auto_cost_analysis ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own cost analysis
CREATE POLICY auto_cost_isolation ON auto_cost_analysis
    FOR ALL USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_auto_cost_analysis_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_auto_cost_analysis_updated_at
    BEFORE UPDATE ON auto_cost_analysis
    FOR EACH ROW
    EXECUTE FUNCTION update_auto_cost_analysis_timestamp();

-- Add helpful comments
COMMENT ON TABLE auto_cost_analysis IS
'Comprehensive automotive cost analysis tracking cost-per-mile over time periods';

COMMENT ON COLUMN auto_cost_analysis.total_miles_driven IS
'Total miles driven during the analysis period';

COMMENT ON COLUMN auto_cost_analysis.total_maintenance_cost IS
'Sum of all maintenance costs during the period';

COMMENT ON COLUMN auto_cost_analysis.total_fuel_cost IS
'Sum of all fuel costs during the period';

COMMENT ON COLUMN auto_cost_analysis.cost_per_mile IS
'Calculated cost per mile (auto-generated): (maintenance + fuel) / miles';
