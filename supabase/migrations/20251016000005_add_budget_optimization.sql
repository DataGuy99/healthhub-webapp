-- Phase 3: Budget-Health Optimization & Smart Queue
-- Creates tables for financial optimization and intelligent purchase queue

-- ================================================================================
-- HEALTH BUDGET ALLOCATION TRACKING
-- ================================================================================

CREATE TABLE IF NOT EXISTS health_budget_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- 'supplements', 'groceries', 'health_devices', etc.
    monthly_budget NUMERIC NOT NULL CHECK (monthly_budget >= 0),
    health_priority INTEGER NOT NULL CHECK (health_priority >= 1 AND health_priority <= 5),
    roi_target NUMERIC, -- Expected ROI percentage
    current_spending NUMERIC DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category)
);

CREATE INDEX idx_budget_allocations_user ON health_budget_allocations(user_id);
CREATE INDEX idx_budget_allocations_priority ON health_budget_allocations(user_id, health_priority DESC);

-- ================================================================================
-- SMART PURCHASE QUEUE
-- ================================================================================

CREATE TABLE IF NOT EXISTS purchase_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    estimated_cost NUMERIC NOT NULL CHECK (estimated_cost >= 0),

    -- Priority scoring components (0-100 scale)
    health_impact_score NUMERIC NOT NULL CHECK (health_impact_score >= 0 AND health_impact_score <= 100),
    affordability_score NUMERIC NOT NULL CHECK (affordability_score >= 0 AND affordability_score <= 100),
    timing_optimality_score NUMERIC NOT NULL CHECK (timing_optimality_score >= 0 AND timing_optimality_score <= 100),
    cost_effectiveness_score NUMERIC NOT NULL CHECK (cost_effectiveness_score >= 0 AND cost_effectiveness_score <= 100),
    urgency_score NUMERIC NOT NULL CHECK (urgency_score >= 0 AND urgency_score <= 100),

    -- Weighted total priority score
    priority_score NUMERIC NOT NULL CHECK (priority_score >= 0 AND priority_score <= 100),
    queue_position INTEGER NOT NULL,

    -- Purchase timing and recommendations
    optimal_purchase_date DATE,
    reasoning TEXT NOT NULL,
    alternative_suggestions JSONB DEFAULT '[]',

    -- Status tracking
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'purchased', 'delayed', 'removed')),

    -- Related supplement or item
    supplement_id UUID REFERENCES supplements(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_queue_user_position ON purchase_queue(user_id, queue_position);
CREATE INDEX idx_queue_user_status ON purchase_queue(user_id, status) WHERE status = 'queued';
CREATE INDEX idx_queue_user_priority ON purchase_queue(user_id, priority_score DESC);
CREATE INDEX idx_queue_optimal_date ON purchase_queue(user_id, optimal_purchase_date);

-- ================================================================================
-- PURCHASE DECISIONS & OUTCOMES
-- ================================================================================

CREATE TABLE IF NOT EXISTS purchase_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    queue_item_id UUID REFERENCES purchase_queue(id) ON DELETE SET NULL,

    item_name TEXT NOT NULL,
    category TEXT NOT NULL,

    -- Decision details
    decision TEXT NOT NULL CHECK (decision IN ('purchased', 'delayed', 'rejected', 'alternative_chosen')),
    reasoning TEXT NOT NULL,
    confidence_score NUMERIC NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),

    -- Cost tracking
    estimated_cost NUMERIC,
    actual_cost NUMERIC,

    -- Outcome tracking (filled in after purchase)
    health_outcome_score NUMERIC CHECK (health_outcome_score >= 0 AND health_outcome_score <= 100),
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    would_purchase_again BOOLEAN,
    outcome_notes TEXT,

    -- Timing
    decision_date TIMESTAMPTZ DEFAULT NOW(),
    outcome_date TIMESTAMPTZ,

    -- Alternative chosen if decision = 'alternative_chosen'
    alternative_item_name TEXT,
    alternative_cost NUMERIC
);

CREATE INDEX idx_decisions_user_date ON purchase_decisions(user_id, decision_date DESC);
CREATE INDEX idx_decisions_category ON purchase_decisions(user_id, category);
CREATE INDEX idx_decisions_outcome ON purchase_decisions(user_id, decision) WHERE health_outcome_score IS NOT NULL;

-- ================================================================================
-- SUPPLEMENT COST TRACKING (Enhance existing supplements table)
-- ================================================================================

-- Add cost tracking columns to supplements table if not exists
ALTER TABLE supplements
ADD COLUMN IF NOT EXISTS monthly_cost NUMERIC,
ADD COLUMN IF NOT EXISTS cost_per_serving NUMERIC,
ADD COLUMN IF NOT EXISTS servings_per_container INTEGER,
ADD COLUMN IF NOT EXISTS last_purchase_date DATE,
ADD COLUMN IF NOT EXISTS last_purchase_cost NUMERIC;

-- ================================================================================
-- HELPER FUNCTIONS
-- ================================================================================

-- Function to recalculate queue positions after priority changes
CREATE OR REPLACE FUNCTION reorder_purchase_queue(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    WITH ranked AS (
        SELECT
            id,
            ROW_NUMBER() OVER (ORDER BY priority_score DESC, created_at ASC) as new_position
        FROM purchase_queue
        WHERE user_id = p_user_id AND status = 'queued'
    )
    UPDATE purchase_queue pq
    SET queue_position = ranked.new_position
    FROM ranked
    WHERE pq.id = ranked.id;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate health ROI for a supplement
CREATE OR REPLACE FUNCTION calculate_supplement_roi(
    p_user_id UUID,
    p_supplement_id UUID,
    p_time_window_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    supplement_id UUID,
    monthly_cost NUMERIC,
    total_health_value NUMERIC,
    roi_percentage NUMERIC,
    recommendation TEXT
) AS $$
DECLARE
    v_monthly_cost NUMERIC;
    v_health_value NUMERIC := 0;
    v_correlation_count INTEGER := 0;
BEGIN
    -- Get supplement monthly cost
    SELECT s.monthly_cost INTO v_monthly_cost
    FROM supplements s
    WHERE s.id = p_supplement_id AND s.user_id = p_user_id;

    -- If no monthly cost, estimate from cost and frequency
    IF v_monthly_cost IS NULL THEN
        SELECT
            COALESCE(s.cost * 30.0 / NULLIF(s.frequency, 0), 0)
        INTO v_monthly_cost
        FROM supplements s
        WHERE s.id = p_supplement_id AND s.user_id = p_user_id;
    END IF;

    -- Calculate total health value from correlations
    -- Each 1% improvement = $1 health value (simplified model)
    SELECT
        SUM(ABS(improvement_percentage) * confidence_level / 100.0),
        COUNT(*)
    INTO v_health_value, v_correlation_count
    FROM health_supplement_correlations
    WHERE user_id = p_user_id
        AND supplement_id = p_supplement_id
        AND is_significant = true;

    -- If we have health value and cost data, calculate ROI
    IF v_monthly_cost > 0 AND v_health_value > 0 THEN
        RETURN QUERY SELECT
            p_supplement_id,
            v_monthly_cost,
            v_health_value,
            (v_health_value / v_monthly_cost * 100.0) as roi_pct,
            CASE
                WHEN (v_health_value / v_monthly_cost * 100.0) > 200 THEN 'increase'
                WHEN (v_health_value / v_monthly_cost * 100.0) > 100 THEN 'maintain'
                WHEN (v_health_value / v_monthly_cost * 100.0) > 50 THEN 'reduce'
                ELSE 'eliminate'
            END;
    ELSE
        -- No data available
        RETURN QUERY SELECT
            p_supplement_id,
            COALESCE(v_monthly_cost, 0),
            COALESCE(v_health_value, 0),
            0::NUMERIC,
            'insufficient_data'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- TRIGGERS
-- ================================================================================

-- Auto-update updated_at timestamp
CREATE TRIGGER update_budget_allocations_updated_at
    BEFORE UPDATE ON health_budget_allocations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_queue_updated_at
    BEFORE UPDATE ON purchase_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================================
-- ROW LEVEL SECURITY
-- ================================================================================

ALTER TABLE health_budget_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_decisions ENABLE ROW LEVEL SECURITY;

-- Health Budget Allocations Policies
CREATE POLICY "Users can manage their own budget allocations"
    ON health_budget_allocations FOR ALL
    USING ((select auth.uid()) = user_id);

-- Purchase Queue Policies
CREATE POLICY "Users can manage their own purchase queue"
    ON purchase_queue FOR ALL
    USING ((select auth.uid()) = user_id);

-- Purchase Decisions Policies
CREATE POLICY "Users can manage their own purchase decisions"
    ON purchase_decisions FOR ALL
    USING ((select auth.uid()) = user_id);
