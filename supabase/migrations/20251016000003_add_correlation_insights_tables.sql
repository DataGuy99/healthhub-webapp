-- Phase 2: Health-Supplement Correlation & Insights Tables
-- Creates tables for storing correlation analysis results and generated insights

-- Table for storing health-supplement correlations
CREATE TABLE IF NOT EXISTS health_supplement_correlations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    supplement_id UUID REFERENCES supplements(id) ON DELETE CASCADE,
    health_metric TEXT NOT NULL,
    correlation_coefficient NUMERIC NOT NULL CHECK (correlation_coefficient >= -1 AND correlation_coefficient <= 1),
    p_value NUMERIC NOT NULL CHECK (p_value >= 0 AND p_value <= 1),
    effect_size NUMERIC NOT NULL,
    sample_size INTEGER NOT NULL CHECK (sample_size > 0),
    time_window_days INTEGER NOT NULL CHECK (time_window_days > 0),
    baseline_average NUMERIC,
    post_supplement_average NUMERIC,
    improvement_percentage NUMERIC,
    confidence_level NUMERIC CHECK (confidence_level >= 0 AND confidence_level <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes for efficient querying
    CONSTRAINT unique_user_supplement_metric UNIQUE(user_id, supplement_id, health_metric, time_window_days)
);

CREATE INDEX idx_correlations_user_supplement ON health_supplement_correlations(user_id, supplement_id);
CREATE INDEX idx_correlations_user_metric ON health_supplement_correlations(user_id, health_metric);
CREATE INDEX idx_correlations_significance ON health_supplement_correlations(user_id, p_value) WHERE p_value < 0.05;
CREATE INDEX idx_correlations_strength ON health_supplement_correlations(user_id, correlation_coefficient);

-- Table for storing generated health insights
CREATE TABLE IF NOT EXISTS health_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL CHECK (insight_type IN ('supplement', 'health', 'budget', 'timing', 'correlation')),
    insight_data JSONB NOT NULL,
    confidence_score NUMERIC NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    priority INTEGER DEFAULT 0 CHECK (priority >= 0 AND priority <= 10),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,

    -- Indexes for efficient querying
    INDEX idx_insights_user_type (user_id, insight_type),
    INDEX idx_insights_generated (user_id, generated_at DESC),
    INDEX idx_insights_priority (user_id, priority DESC, generated_at DESC) WHERE acknowledged_at IS NULL AND dismissed_at IS NULL
);

-- Table for supplement ROI analysis
CREATE TABLE IF NOT EXISTS supplement_roi_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    supplement_id UUID REFERENCES supplements(id) ON DELETE CASCADE,
    analysis_period_start DATE NOT NULL,
    analysis_period_end DATE NOT NULL,
    total_cost_per_month NUMERIC NOT NULL CHECK (total_cost_per_month >= 0),
    health_improvements JSONB NOT NULL, -- Array of {metric, improvement_value, improvement_percentage, monetary_value}
    roi_score NUMERIC NOT NULL,
    cost_per_health_point NUMERIC,
    recommendation TEXT CHECK (recommendation IN ('continue', 'optimize', 'discontinue', 'increase')),
    alternative_suggestions JSONB, -- Array of alternative supplement suggestions
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_user_supplement_period UNIQUE(user_id, supplement_id, analysis_period_start, analysis_period_end)
);

CREATE INDEX idx_roi_user_supplement ON supplement_roi_analysis(user_id, supplement_id);
CREATE INDEX idx_roi_user_score ON supplement_roi_analysis(user_id, roi_score DESC);
CREATE INDEX idx_roi_period ON supplement_roi_analysis(user_id, analysis_period_end DESC);

-- Table for tracking correlation calculation jobs
CREATE TABLE IF NOT EXISTS correlation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL CHECK (job_type IN ('full_analysis', 'incremental', 'single_supplement')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    parameters JSONB,
    results_summary JSONB,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    INDEX idx_jobs_user_status (user_id, status, created_at DESC)
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on correlations table
CREATE TRIGGER update_correlations_updated_at
    BEFORE UPDATE ON health_supplement_correlations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE health_supplement_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplement_roi_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE correlation_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for correlations
CREATE POLICY "Users can view their own correlations"
    ON health_supplement_correlations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own correlations"
    ON health_supplement_correlations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own correlations"
    ON health_supplement_correlations FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own correlations"
    ON health_supplement_correlations FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for insights
CREATE POLICY "Users can view their own insights"
    ON health_insights FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own insights"
    ON health_insights FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own insights"
    ON health_insights FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policies for ROI analysis
CREATE POLICY "Users can view their own ROI analysis"
    ON supplement_roi_analysis FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ROI analysis"
    ON supplement_roi_analysis FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ROI analysis"
    ON supplement_roi_analysis FOR UPDATE
    USING (auth.uid() = user_id);

-- RLS Policies for correlation jobs
CREATE POLICY "Users can view their own correlation jobs"
    ON correlation_jobs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own correlation jobs"
    ON correlation_jobs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own correlation jobs"
    ON correlation_jobs FOR UPDATE
    USING (auth.uid() = user_id);
