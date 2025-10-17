-- HealthHub Complete Database Schema
-- IMPORTANT: This will WIPE and recreate your entire database
-- Backup any important data before running this script
-- Created: 2025-10-16

-- DROP all existing tables (in dependency order)
DROP TABLE IF EXISTS public.health_supplement_correlations CASCADE;
DROP TABLE IF EXISTS public.health_insights CASCADE;
DROP TABLE IF EXISTS public.supplement_roi_analysis CASCADE;
DROP TABLE IF EXISTS public.correlation_jobs CASCADE;
DROP TABLE IF EXISTS public.health_data_points CASCADE;
DROP TABLE IF EXISTS public.health_data_upload CASCADE;
DROP TABLE IF EXISTS public.health_sync_status CASCADE;
DROP TABLE IF EXISTS public.health_exports CASCADE;
DROP TABLE IF EXISTS public.auto_cost_analysis CASCADE;
DROP TABLE IF EXISTS public.supplement_logs CASCADE;
DROP TABLE IF EXISTS public.supplements CASCADE;
DROP TABLE IF EXISTS public.supplement_sections CASCADE;
DROP TABLE IF EXISTS public.category_logs CASCADE;
DROP TABLE IF EXISTS public.category_items CASCADE;
DROP TABLE IF EXISTS public.category_budgets CASCADE;
DROP TABLE IF EXISTS public.bill_payments CASCADE;
DROP TABLE IF EXISTS public.recurring_bills CASCADE;
DROP TABLE IF EXISTS public.transaction_items CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.transaction_rules CASCADE;
DROP TABLE IF EXISTS public.budget_goals CASCADE;
DROP TABLE IF EXISTS public.budget_categories CASCADE;
DROP TABLE IF EXISTS public.plaid_sync_cursors CASCADE;
DROP TABLE IF EXISTS public.bank_accounts CASCADE;
DROP TABLE IF EXISTS public.grocery_purchases CASCADE;
DROP TABLE IF EXISTS public.grocery_budgets CASCADE;
DROP TABLE IF EXISTS public.protein_calculations CASCADE;
DROP TABLE IF EXISTS public.protein_targets CASCADE;
DROP TABLE IF EXISTS public.misc_shop_purchases CASCADE;
DROP TABLE IF EXISTS public.misc_shop_budgets CASCADE;
DROP TABLE IF EXISTS public.gas_fillups CASCADE;
DROP TABLE IF EXISTS public.maintenance_items CASCADE;
DROP TABLE IF EXISTS public.user_categories CASCADE;
DROP TABLE IF EXISTS public.user_settings CASCADE;
DROP TABLE IF EXISTS public.budget_settings CASCADE;

-- ================================================================================
-- USER SETTINGS & CONFIGURATION
-- ================================================================================

CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    supplement_auto_log_time TIME DEFAULT '00:00:00',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.budget_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    period_type TEXT NOT NULL CHECK (period_type IN ('weekly', 'biweekly', 'monthly', 'custom')),
    period_start_day INTEGER CHECK (period_start_day >= 0 AND period_start_day <= 31),
    period_start_date DATE,
    period_length_days INTEGER CHECK (period_length_days > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '📁',
    color TEXT NOT NULL,
    template TEXT NOT NULL CHECK (template IN ('checklist', 'spending', 'events', 'investments', 'custom')),
    "order" INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    sub_tabs JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================================
-- CATEGORY ITEMS & LOGS (Generic system for all categories)
-- ================================================================================

CREATE TABLE IF NOT EXISTS public.category_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    amount NUMERIC,
    frequency TEXT,
    subcategory TEXT,
    tags TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_category_items_user_category ON public.category_items(user_id, category);
CREATE INDEX idx_category_items_active ON public.category_items(user_id, is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.category_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_item_id UUID NOT NULL REFERENCES public.category_items(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    actual_amount NUMERIC,
    notes TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    is_planned BOOLEAN DEFAULT true
);

CREATE INDEX idx_category_logs_user_date ON public.category_logs(user_id, date DESC);
CREATE INDEX idx_category_logs_item_date ON public.category_logs(category_item_id, date DESC);

CREATE TABLE IF NOT EXISTS public.category_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    month_year TEXT NOT NULL,
    target_amount NUMERIC NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category, month_year)
);

CREATE INDEX idx_category_budgets_user_category ON public.category_budgets(user_id, category);

-- ================================================================================
-- SUPPLEMENTS SYSTEM
-- ================================================================================

CREATE TABLE IF NOT EXISTS public.supplement_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_supplement_sections_user ON public.supplement_sections(user_id);

CREATE TABLE IF NOT EXISTS public.supplements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    dose TEXT,
    dose_unit TEXT,
    ingredients JSONB,
    form TEXT,
    section TEXT,
    active_days JSONB,
    frequency_pattern TEXT DEFAULT 'everyday' CHECK (frequency_pattern IN ('everyday', '5/2', 'workout', 'custom')),
    is_stack BOOLEAN DEFAULT false,
    stack_id UUID REFERENCES public.supplements(id) ON DELETE SET NULL,
    "order" INTEGER DEFAULT 0,
    cost NUMERIC CHECK (cost IS NULL OR cost >= 0),
    quantity INTEGER CHECK (quantity IS NULL OR quantity >= 0),
    frequency INTEGER DEFAULT 1 CHECK (frequency IS NULL OR frequency >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_supplements_user_active ON public.supplements(user_id, is_stack);
CREATE INDEX idx_supplements_section ON public.supplements(user_id, section);
CREATE INDEX idx_supplements_stack ON public.supplements(stack_id) WHERE stack_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.supplement_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    supplement_id UUID NOT NULL REFERENCES public.supplements(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_taken BOOLEAN DEFAULT false,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, supplement_id, date)
);

CREATE INDEX idx_supplement_logs_user_date ON public.supplement_logs(user_id, date DESC);
CREATE INDEX idx_supplement_logs_supplement ON public.supplement_logs(supplement_id, date DESC);

-- ================================================================================
-- FINANCE & BANKING
-- ================================================================================

CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plaid_access_token TEXT NOT NULL,
    plaid_item_id TEXT NOT NULL,
    institution_name TEXT NOT NULL,
    institution_id TEXT,
    account_name TEXT,
    account_mask TEXT,
    account_type TEXT,
    account_subtype TEXT,
    is_active BOOLEAN DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bank_accounts_user_active ON public.bank_accounts(user_id, is_active);

CREATE TABLE IF NOT EXISTS public.plaid_sync_cursors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL UNIQUE REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    cursor TEXT NOT NULL,
    last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_plaid_sync_user ON public.plaid_sync_cursors(user_id);

CREATE TABLE IF NOT EXISTS public.budget_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    parent_category_id UUID REFERENCES public.budget_categories(id) ON DELETE SET NULL,
    is_system BOOLEAN DEFAULT false,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_budget_categories_user ON public.budget_categories(user_id);
CREATE INDEX idx_budget_categories_parent ON public.budget_categories(parent_category_id) WHERE parent_category_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    plaid_transaction_id TEXT,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    timestamp TIMESTAMPTZ,
    merchant TEXT,
    description TEXT,
    category_id UUID REFERENCES public.budget_categories(id) ON DELETE SET NULL,
    auto_categorized BOOLEAN DEFAULT false,
    is_recurring BOOLEAN DEFAULT false,
    recurring_series_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX idx_transactions_category ON public.transactions(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_transactions_bank_account ON public.transactions(bank_account_id) WHERE bank_account_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    pretax_amount NUMERIC NOT NULL,
    quantity NUMERIC DEFAULT 1,
    unit_price NUMERIC,
    category_id UUID REFERENCES public.budget_categories(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transaction_items_transaction ON public.transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_user ON public.transaction_items(user_id);

CREATE TABLE IF NOT EXISTS public.transaction_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    category TEXT NOT NULL,
    template TEXT NOT NULL CHECK (template IN ('market', 'covenant', 'chronicle', 'treasury')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transaction_rules_user ON public.transaction_rules(user_id);

CREATE TABLE IF NOT EXISTS public.budget_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.budget_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount NUMERIC NOT NULL,
    period TEXT NOT NULL CHECK (period IN ('weekly', 'monthly', 'yearly')),
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_budget_goals_user_active ON public.budget_goals(user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_budget_goals_category ON public.budget_goals(category_id) WHERE category_id IS NOT NULL;

-- ================================================================================
-- BILLS & PAYMENTS
-- ================================================================================

CREATE TABLE IF NOT EXISTS public.recurring_bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'custom')),
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31),
    skip_first_week BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    color TEXT,
    icon TEXT DEFAULT '💵',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recurring_bills_user_active ON public.recurring_bills(user_id, is_active);

CREATE TABLE IF NOT EXISTS public.bill_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recurring_bill_id UUID NOT NULL REFERENCES public.recurring_bills(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    amount NUMERIC NOT NULL,
    paid BOOLEAN DEFAULT false,
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bill_payments_user_date ON public.bill_payments(user_id, date DESC);
CREATE INDEX idx_bill_payments_recurring_bill ON public.bill_payments(recurring_bill_id);
CREATE INDEX idx_bill_payments_unpaid ON public.bill_payments(user_id, date) WHERE paid = false;

-- ================================================================================
-- GROCERY & PROTEIN TRACKING
-- ================================================================================

CREATE TABLE IF NOT EXISTS public.grocery_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    weekly_budget NUMERIC NOT NULL DEFAULT 90.00,
    daily_protein_goal NUMERIC DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.grocery_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    store TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    protein_grams NUMERIC,
    days_covered NUMERIC,
    is_protein_source BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_grocery_purchases_user_date ON public.grocery_purchases(user_id, date DESC);

CREATE TABLE IF NOT EXISTS public.protein_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    target_cost_per_gram NUMERIC NOT NULL,
    tolerance_percentage NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.protein_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    food_name TEXT NOT NULL,
    serving_size NUMERIC NOT NULL,
    serving_unit TEXT NOT NULL,
    protein_grams NUMERIC NOT NULL,
    price NUMERIC NOT NULL,
    cost_per_gram NUMERIC NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    num_servings NUMERIC DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_protein_calculations_user_date ON public.protein_calculations(user_id, date DESC);
CREATE INDEX idx_protein_calculations_cost ON public.protein_calculations(user_id, cost_per_gram);

-- ================================================================================
-- MISC SHOPPING
-- ================================================================================

CREATE TABLE IF NOT EXISTS public.misc_shop_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    monthly_budget NUMERIC NOT NULL DEFAULT 30.00,
    rollover_savings NUMERIC NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.misc_shop_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    is_big_purchase BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_misc_shop_purchases_user_date ON public.misc_shop_purchases(user_id, date DESC);

-- ================================================================================
-- AUTOMOTIVE
-- ================================================================================

CREATE TABLE IF NOT EXISTS public.gas_fillups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    mileage INTEGER NOT NULL,
    gallons NUMERIC NOT NULL,
    cost NUMERIC NOT NULL,
    price_per_gallon NUMERIC NOT NULL,
    mpg NUMERIC,
    cost_per_mile_at_fillup NUMERIC,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gas_fillups_user_date ON public.gas_fillups(user_id, date DESC);
CREATE INDEX idx_gas_fillups_mileage ON public.gas_fillups(user_id, mileage);

CREATE TABLE IF NOT EXISTS public.maintenance_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    interval_miles INTEGER NOT NULL,
    last_done_mileage INTEGER NOT NULL,
    estimated_cost NUMERIC DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    icon TEXT DEFAULT '🔧',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_maintenance_items_user_active ON public.maintenance_items(user_id, is_active);

CREATE TABLE IF NOT EXISTS public.auto_cost_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    analysis_period_start DATE NOT NULL,
    analysis_period_end DATE NOT NULL,
    total_miles_driven NUMERIC NOT NULL CHECK (total_miles_driven >= 0),
    total_maintenance_cost NUMERIC NOT NULL DEFAULT 0.00 CHECK (total_maintenance_cost >= 0),
    total_fuel_cost NUMERIC NOT NULL DEFAULT 0.00 CHECK (total_fuel_cost >= 0),
    average_mpg NUMERIC NOT NULL CHECK (average_mpg > 0),
    average_gas_price NUMERIC NOT NULL CHECK (average_gas_price >= 0),
    cost_per_mile NUMERIC GENERATED ALWAYS AS (
        CASE
            WHEN total_miles_driven > 0 THEN (total_maintenance_cost + total_fuel_cost) / total_miles_driven
            ELSE NULL
        END
    ) STORED,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auto_cost_user_period ON public.auto_cost_analysis(user_id, analysis_period_end DESC);

-- ================================================================================
-- HEALTH DATA TRACKING (Phase 1)
-- ================================================================================

CREATE TABLE IF NOT EXISTS public.health_exports (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    export_time TIMESTAMPTZ NOT NULL,
    data JSONB NOT NULL,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_health_exports_user_time ON public.health_exports(user_id, export_time DESC);

CREATE TABLE IF NOT EXISTS public.health_data_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL,
    value NUMERIC NOT NULL CHECK (value >= 0),
    accuracy INTEGER CHECK (accuracy >= 0 AND accuracy <= 100),
    source TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_health_data_user_type_time ON public.health_data_points(user_id, type, timestamp DESC);
CREATE INDEX idx_health_data_high_accuracy ON public.health_data_points(user_id, accuracy DESC) WHERE accuracy >= 80;

CREATE TABLE IF NOT EXISTS public.health_data_upload (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    encrypted_data INTEGER[] NOT NULL,
    iv INTEGER[] NOT NULL,
    data_point_count INTEGER NOT NULL CHECK (data_point_count >= 0),
    extraction_timestamp TIMESTAMPTZ NOT NULL,
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_health_upload_user_unprocessed ON public.health_data_upload(user_id, processed) WHERE processed = false;

CREATE TABLE IF NOT EXISTS public.health_sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    last_sync_timestamp TIMESTAMPTZ,
    data_points_count INTEGER DEFAULT 0 CHECK (data_points_count >= 0),
    sync_errors JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================================
-- HEALTH-SUPPLEMENT CORRELATIONS & INSIGHTS (Phase 2)
-- ================================================================================

CREATE TABLE IF NOT EXISTS public.health_supplement_correlations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    supplement_id UUID REFERENCES public.supplements(id) ON DELETE CASCADE,
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
    UNIQUE(user_id, supplement_id, health_metric, time_window_days)
);

CREATE INDEX idx_correlations_user_supplement ON public.health_supplement_correlations(user_id, supplement_id);
CREATE INDEX idx_correlations_user_metric ON public.health_supplement_correlations(user_id, health_metric);
CREATE INDEX idx_correlations_significant ON public.health_supplement_correlations(user_id, p_value, confidence_level DESC) WHERE p_value < 0.05;

CREATE TABLE IF NOT EXISTS public.health_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL CHECK (insight_type IN ('supplement', 'health', 'budget', 'timing', 'correlation')),
    insight_data JSONB NOT NULL,
    confidence_score NUMERIC NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    priority INTEGER DEFAULT 0 CHECK (priority >= 0 AND priority <= 10),
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ
);

CREATE INDEX idx_insights_user_type ON public.health_insights(user_id, insight_type);
CREATE INDEX idx_insights_active_priority ON public.health_insights(user_id, priority DESC, generated_at DESC) WHERE acknowledged_at IS NULL AND dismissed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.supplement_roi_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    supplement_id UUID REFERENCES public.supplements(id) ON DELETE CASCADE,
    analysis_period_start DATE NOT NULL,
    analysis_period_end DATE NOT NULL,
    total_cost_per_month NUMERIC NOT NULL CHECK (total_cost_per_month >= 0),
    health_improvements JSONB NOT NULL,
    roi_score NUMERIC NOT NULL,
    cost_per_health_point NUMERIC,
    recommendation TEXT CHECK (recommendation IN ('continue', 'optimize', 'discontinue', 'increase')),
    alternative_suggestions JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, supplement_id, analysis_period_start, analysis_period_end)
);

CREATE INDEX idx_roi_user_supplement ON public.supplement_roi_analysis(user_id, supplement_id);
CREATE INDEX idx_roi_user_score ON public.supplement_roi_analysis(user_id, roi_score DESC);

CREATE TABLE IF NOT EXISTS public.correlation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL CHECK (job_type IN ('full_analysis', 'incremental', 'single_supplement')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    parameters JSONB,
    results_summary JSONB,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_correlation_jobs_user_status ON public.correlation_jobs(user_id, status, created_at DESC);

-- ================================================================================
-- FUNCTIONS & TRIGGERS
-- ================================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables with updated_at column
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_budget_settings_updated_at BEFORE UPDATE ON public.budget_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_categories_updated_at BEFORE UPDATE ON public.user_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_category_items_updated_at BEFORE UPDATE ON public.category_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_category_budgets_updated_at BEFORE UPDATE ON public.category_budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_budget_categories_updated_at BEFORE UPDATE ON public.budget_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transaction_items_updated_at BEFORE UPDATE ON public.transaction_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transaction_rules_updated_at BEFORE UPDATE ON public.transaction_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_budget_goals_updated_at BEFORE UPDATE ON public.budget_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_recurring_bills_updated_at BEFORE UPDATE ON public.recurring_bills FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bill_payments_updated_at BEFORE UPDATE ON public.bill_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_grocery_budgets_updated_at BEFORE UPDATE ON public.grocery_budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_protein_targets_updated_at BEFORE UPDATE ON public.protein_targets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_misc_shop_budgets_updated_at BEFORE UPDATE ON public.misc_shop_budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_auto_cost_analysis_updated_at BEFORE UPDATE ON public.auto_cost_analysis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_health_sync_status_updated_at BEFORE UPDATE ON public.health_sync_status FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_correlations_updated_at BEFORE UPDATE ON public.health_supplement_correlations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================================

-- Enable RLS on all tables
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plaid_sync_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grocery_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grocery_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protein_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protein_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.misc_shop_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.misc_shop_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gas_fillups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_cost_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_data_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_data_upload ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_supplement_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_roi_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.correlation_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (SELECT, INSERT, UPDATE, DELETE for user's own data)
-- User Settings
CREATE POLICY "Users can manage their own settings" ON public.user_settings FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own budget settings" ON public.budget_settings FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own categories" ON public.user_categories FOR ALL USING ((select auth.uid()) = user_id);

-- Category System
CREATE POLICY "Users can manage their own category items" ON public.category_items FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own category logs" ON public.category_logs FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own category budgets" ON public.category_budgets FOR ALL USING ((select auth.uid()) = user_id);

-- Supplements
CREATE POLICY "Users can manage their own supplement sections" ON public.supplement_sections FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own supplements" ON public.supplements FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own supplement logs" ON public.supplement_logs FOR ALL USING ((select auth.uid()) = user_id);

-- Finance
CREATE POLICY "Users can manage their own bank accounts" ON public.bank_accounts FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own plaid sync cursors" ON public.plaid_sync_cursors FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own budget categories" ON public.budget_categories FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own transactions" ON public.transactions FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own transaction items" ON public.transaction_items FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own transaction rules" ON public.transaction_rules FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own budget goals" ON public.budget_goals FOR ALL USING ((select auth.uid()) = user_id);

-- Bills
CREATE POLICY "Users can manage their own recurring bills" ON public.recurring_bills FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own bill payments" ON public.bill_payments FOR ALL USING ((select auth.uid()) = user_id);

-- Grocery
CREATE POLICY "Users can manage their own grocery budgets" ON public.grocery_budgets FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own grocery purchases" ON public.grocery_purchases FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own protein targets" ON public.protein_targets FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own protein calculations" ON public.protein_calculations FOR ALL USING ((select auth.uid()) = user_id);

-- Misc Shopping
CREATE POLICY "Users can manage their own misc shop budgets" ON public.misc_shop_budgets FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own misc shop purchases" ON public.misc_shop_purchases FOR ALL USING ((select auth.uid()) = user_id);

-- Auto
CREATE POLICY "Users can manage their own gas fillups" ON public.gas_fillups FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own maintenance items" ON public.maintenance_items FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own auto cost analysis" ON public.auto_cost_analysis FOR ALL USING ((select auth.uid()) = user_id);

-- Health (Note: health_exports uses TEXT user_id, not UUID)
CREATE POLICY "Users can view their own health exports" ON public.health_exports FOR SELECT USING (user_id = auth.uid()::text);
CREATE POLICY "Users can insert their own health exports" ON public.health_exports FOR INSERT WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY "Users can manage their own health data points" ON public.health_data_points FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own health data uploads" ON public.health_data_upload FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own health sync status" ON public.health_sync_status FOR ALL USING ((select auth.uid()) = user_id);

-- Health Correlations & Insights
CREATE POLICY "Users can manage their own correlations" ON public.health_supplement_correlations FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own insights" ON public.health_insights FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own ROI analysis" ON public.supplement_roi_analysis FOR ALL USING ((select auth.uid()) = user_id);
CREATE POLICY "Users can manage their own correlation jobs" ON public.correlation_jobs FOR ALL USING ((select auth.uid()) = user_id);
