-- Migration: Add health data tracking from Android HealthConnect
-- Created: 2025-10-16
-- Purpose: Store ultra-rich health data points with sub-minute granularity

-- Main health data points table
CREATE TABLE IF NOT EXISTS health_data_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL, -- 'heart_rate', 'blood_oxygen', 'respiratory_rate', 'steps', 'sleep', etc.
    value NUMERIC NOT NULL,
    accuracy INTEGER CHECK (accuracy >= 0 AND accuracy <= 100),
    source TEXT NOT NULL, -- 'smartwatch', 'phone', 'manual', etc.
    context JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_accuracy CHECK (accuracy IS NULL OR (accuracy >= 0 AND accuracy <= 100)),
    CONSTRAINT valid_value CHECK (value >= 0) -- Most health metrics are non-negative
);

-- Comments for documentation
COMMENT ON TABLE health_data_points IS
'Ultra-rich health data from Android HealthConnect with sub-minute granularity';

COMMENT ON COLUMN health_data_points.type IS
'Type of health metric: heart_rate, blood_oxygen, respiratory_rate, body_temperature, steps, distance, calories, exercise, sleep_stage, nutrition, hydration, stress_level, etc.';

COMMENT ON COLUMN health_data_points.context IS
'Contextual information: activity, location, supplement_logs, sleep_stage, stress_level';

COMMENT ON COLUMN health_data_points.metadata IS
'Device and environmental metadata: device_id, battery_level, sensor_confidence, environmental conditions';

-- Create efficient indexes
CREATE INDEX IF NOT EXISTS idx_health_data_user_timestamp
ON health_data_points (user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_health_data_user_type
ON health_data_points (user_id, type, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_health_data_user_date
ON health_data_points (user_id, (timestamp::date), type);

-- Partial index for high-accuracy data points
CREATE INDEX IF NOT EXISTS idx_health_data_high_accuracy
ON health_data_points (user_id, type, timestamp DESC)
WHERE accuracy >= 90;

-- Enable Row Level Security
ALTER TABLE health_data_points ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own health data
CREATE POLICY health_data_isolation ON health_data_points
    FOR ALL USING (auth.uid() = user_id);

-- Health data sync status tracking
CREATE TABLE IF NOT EXISTS health_sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    last_sync_timestamp TIMESTAMPTZ,
    data_points_count INTEGER DEFAULT 0,
    sync_errors JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT non_negative_count CHECK (data_points_count >= 0),
    CONSTRAINT unique_user_sync UNIQUE (user_id)
);

COMMENT ON TABLE health_sync_status IS
'Tracks Android HealthConnect sync status and errors per user';

-- Create index for sync status queries
CREATE INDEX IF NOT EXISTS idx_sync_status_user
ON health_sync_status (user_id);

CREATE INDEX IF NOT EXISTS idx_sync_status_timestamp
ON health_sync_status (last_sync_timestamp DESC);

-- Enable Row Level Security
ALTER TABLE health_sync_status ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own sync status
CREATE POLICY health_sync_isolation ON health_sync_status
    FOR ALL USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_health_sync_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_health_sync_updated_at
    BEFORE UPDATE ON health_sync_status
    FOR EACH ROW
    EXECUTE FUNCTION update_health_sync_timestamp();

-- Add helper function to get latest health data point
CREATE OR REPLACE FUNCTION get_latest_health_data(
    p_user_id UUID,
    p_type TEXT,
    p_hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
    timestamp TIMESTAMPTZ,
    value NUMERIC,
    accuracy INTEGER,
    source TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        hdp.timestamp,
        hdp.value,
        hdp.accuracy,
        hdp.source
    FROM health_data_points hdp
    WHERE hdp.user_id = p_user_id
        AND hdp.type = p_type
        AND hdp.timestamp >= NOW() - (p_hours_back || ' hours')::INTERVAL
    ORDER BY hdp.timestamp DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helper function to get health data range
CREATE OR REPLACE FUNCTION get_health_data_range(
    p_user_id UUID,
    p_type TEXT,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ
)
RETURNS TABLE (
    timestamp TIMESTAMPTZ,
    value NUMERIC,
    accuracy INTEGER,
    source TEXT,
    context JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        hdp.timestamp,
        hdp.value,
        hdp.accuracy,
        hdp.source,
        hdp.context
    FROM health_data_points hdp
    WHERE hdp.user_id = p_user_id
        AND hdp.type = p_type
        AND hdp.timestamp >= p_start_time
        AND hdp.timestamp <= p_end_time
    ORDER BY hdp.timestamp ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments to helper functions
COMMENT ON FUNCTION get_latest_health_data IS
'Retrieve the most recent health data point for a specific metric type';

COMMENT ON FUNCTION get_health_data_range IS
'Retrieve all health data points within a time range for a specific metric type';
