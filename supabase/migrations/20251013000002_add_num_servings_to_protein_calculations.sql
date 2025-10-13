-- Add num_servings column to protein_calculations
-- Created: 2025-10-13
-- Purpose: Track number of servings for accurate cost per gram calculation

ALTER TABLE protein_calculations
ADD COLUMN IF NOT EXISTS num_servings DECIMAL(10,2) DEFAULT 1.0;

COMMENT ON COLUMN protein_calculations.num_servings IS 'Number of servings in the package (for calculating total protein)';

-- Update existing rows to have num_servings = 1 (assumes old calculations were for single serving)
UPDATE protein_calculations
SET num_servings = 1.0
WHERE num_servings IS NULL;
