-- HealthHub Complete Database Schema (with Phase 6.2 UX Restructuring)
-- IMPORTANT: This will WIPE and recreate your entire database
-- Backup any important data before running this script
-- Created: 2025-10-16
-- Updated: 2025-10-18 (Phase 6.2 integrated)

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
DROP TABLE IF EXISTS public.import_logs CASCADE;
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
    supplement_id UUID,
    recurring_bill_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_category_items_user_category ON public.category_items(user_id, category);
CREATE INDEX IF NOT EXISTS idx_category_items_active ON public.category_items(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_category_items_supplement ON public.category_items(supplement_id) WHERE supplement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_category_items_bill ON public.category_items(recurring_bill_id) WHERE recurring_bill_id IS NOT NULL;

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

CREATE INDEX IF NOT EXISTS idx_category_logs_user_date ON public.category_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_category_logs_item_date ON public.category_logs(category_item_id, date DESC);

CREATE TABLE IF NOT EXISTS public.category_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    month_year TEXT NOT NULL,
    target_amount NUMERIC NOT NULL,
    notes TEXT,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category, month_year)
);

CREATE INDEX IF NOT EXISTS idx_category_budgets_user_category ON public.category_budgets(user_id, category);
CREATE INDEX IF NOT EXISTS idx_category_budgets_enabled ON public.category_budgets(user_id, is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_category_budgets_user_month_year ON public.category_budgets(user_id, month_year);

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

CREATE INDEX IF NOT EXISTS idx_supplement_sections_user ON public.supplement_sections(user_id);
CREATE INDEX IF NOT EXISTS idx_supplement_sections_user_order ON public.supplement_sections(user_id, "order");

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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Phase 6.2: Enhanced frequency and purchase tracking
    frequency_type TEXT DEFAULT 'daily' CHECK (frequency_type IN ('daily', 'weekly', 'alternating', 'cyclic', 'custom')),
    frequency_config JSONB, -- Complex frequency patterns
    product_url TEXT,
    cost_per_container NUMERIC(10,2),
    servings_per_container INTEGER,
    last_purchase_date DATE,
    is_in_stock BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_supplements_user_active ON public.supplements(user_id, is_stack);
CREATE INDEX IF NOT EXISTS idx_supplements_section ON public.supplements(user_id, section);
CREATE INDEX IF NOT EXISTS idx_supplements_stack ON public.supplements(stack_id) WHERE stack_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplements_user_section_order ON public.supplements(user_id, section, "order");

CREATE TABLE IF NOT EXISTS public.supplement_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    supplement_id UUID NOT NULL REFERENCES public.supplements(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_taken BOOLEAN DEFAULT false,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, supplement_id, date)
);

CREATE INDEX IF NOT EXISTS idx_supplement_logs_user_date ON public.supplement_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_supplement_logs_supplement ON public.supplement_logs(supplement_id, date DESC);

-- Phase 6.2: Supplement purchases and budgets
CREATE TABLE IF NOT EXISTS public.supplement_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    supplement_id UUID REFERENCES public.supplements(id) ON DELETE CASCADE,
    purchase_date DATE NOT NULL,
    cost NUMERIC(10,2) NOT NULL,
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplement_purchases_user_date ON public.supplement_purchases(user_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_supplement_purchases_supplement ON public.supplement_purchases(supplement_id);

CREATE TABLE IF NOT EXISTS public.supplement_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    budget_amount NUMERIC(10,2) NOT NULL,
    month_year TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_supplement_budgets_user_month ON public.supplement_budgets(user_id, month_year);

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

CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_active ON public.bank_accounts(user_id, is_active);

CREATE TABLE IF NOT EXISTS public.plaid_sync_cursors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bank_account_id UUID NOT NULL UNIQUE REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    cursor TEXT NOT NULL,
    last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plaid_sync_user ON public.plaid_sync_cursors(user_id);

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

CREATE INDEX IF NOT EXISTS idx_budget_categories_user ON public.budget_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_categories_parent ON public.budget_categories(parent_category_id) WHERE parent_category_id IS NOT NULL;

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

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_bank_account ON public.transactions(bank_account_id) WHERE bank_account_id IS NOT NULL;

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

CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON public.transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_user ON public.transaction_items(user_id);

CREATE TABLE IF NOT EXISTS public.transaction_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    category TEXT NOT NULL,
    template TEXT NOT NULL CHECK (template IN ('market', 'covenant', 'chronicle', 'treasury')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transaction_rules_user ON public.transaction_rules(user_id);

-- Import audit logs for tracking CSV and HealthConnect imports
CREATE TABLE IF NOT EXISTS public.import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    import_type TEXT NOT NULL CHECK (import_type IN ('csv', 'healthconnect', 'plaid')),
    rows_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_logs_user_created ON public.import_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_logs_type ON public.import_logs(import_type);

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

CREATE INDEX IF NOT EXISTS idx_budget_goals_user_active ON public.budget_goals(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_budget_goals_category ON public.budget_goals(category_id) WHERE category_id IS NOT NULL;

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
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Phase 6.2: Flexible recurrence and income tracking
    recurrence_type TEXT DEFAULT 'monthly' CHECK (recurrence_type IN ('monthly', 'weekly', 'biweekly', 'custom')),
    recurrence_config JSONB, -- Complex recurrence patterns like "every Friday except first Friday"
    provider TEXT, -- Auto-populated from bill name
    is_income BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_recurring_bills_user_active ON public.recurring_bills(user_id, is_active);

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

CREATE INDEX IF NOT EXISTS idx_bill_payments_user_date ON public.bill_payments(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_bill_payments_recurring_bill ON public.bill_payments(recurring_bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_payments_unpaid ON public.bill_payments(user_id, date) WHERE paid = false;

-- Phase 6.2: Income tracking settings
CREATE TABLE IF NOT EXISTS public.income_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    post_tax_hourly_rate NUMERIC(10,2),
    hours_per_week NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_income_settings_user ON public.income_settings(user_id);

-- ================================================================================
-- GROCERY & PROTEIN TRACKING
-- ================================================================================

-- Phase 6.2: Favorite foods (must be created before grocery_purchases due to FK)
CREATE TABLE IF NOT EXISTS public.favorite_foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    total_cost NUMERIC(10,2) NOT NULL,
    protein_grams NUMERIC(8,2),
    cost_per_gram NUMERIC(10,4),
    servings INTEGER,
    serving_size_oz NUMERIC(6,2),
    macros JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, item_name)
);

CREATE INDEX IF NOT EXISTS idx_favorite_foods_user ON public.favorite_foods(user_id);

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
    cost_per_gram NUMERIC GENERATED ALWAYS AS (
        CASE
            WHEN protein_grams > 0 THEN amount / protein_grams
            ELSE NULL
        END
    ) STORED,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Phase 6.2: Enhanced with quantity and favorite reference
    quantity INTEGER DEFAULT 1,
    favorite_food_id UUID REFERENCES public.favorite_foods(id),
    carbs_grams NUMERIC(8,2),
    fat_grams NUMERIC(8,2),
    calories NUMERIC(8,2),
    servings INTEGER
);

CREATE INDEX IF NOT EXISTS idx_grocery_purchases_user_date ON public.grocery_purchases(user_id, date DESC);

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

CREATE INDEX IF NOT EXISTS idx_protein_calculations_user_date ON public.protein_calculations(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_protein_calculations_cost ON public.protein_calculations(user_id, cost_per_gram);

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
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Phase 6.2: Removed is_big_purchase (needs/wants distinction), added category
    category TEXT DEFAULT 'misc'
);

CREATE INDEX IF NOT EXISTS idx_misc_shop_purchases_user_date ON public.misc_shop_purchases(user_id, date DESC);

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

CREATE INDEX IF NOT EXISTS idx_gas_fillups_user_date ON public.gas_fillups(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_gas_fillups_mileage ON public.gas_fillups(user_id, mileage);
CREATE INDEX IF NOT EXISTS idx_gas_fillups_user_date_mileage ON public.gas_fillups(user_id, date, mileage);

CREATE TABLE IF NOT EXISTS public.maintenance_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    interval_miles INTEGER NOT NULL,
    last_done_mileage INTEGER NOT NULL,
    estimated_cost NUMERIC DEFAULT 0.00,
    is_active BOOLEAN DEFAULT true,
    icon TEXT DEFAULT '🔧',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Phase 6.2: Projected maintenance tracking
    is_projected BOOLEAN DEFAULT FALSE,
    projected_interval_miles INTEGER,
    last_completed_mileage INTEGER,
    next_due_mileage INTEGER,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_date DATE
);

CREATE INDEX IF NOT EXISTS idx_maintenance_items_user_active ON public.maintenance_items(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_maintenance_items_user_active_name ON public.maintenance_items(user_id, is_active, service_name);

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

CREATE INDEX IF NOT EXISTS idx_auto_cost_user_period ON public.auto_cost_analysis(user_id, analysis_period_end DESC);

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

CREATE INDEX IF NOT EXISTS idx_health_exports_user_time ON public.health_exports(user_id, export_time DESC);

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

CREATE INDEX IF NOT EXISTS idx_health_data_user_type_time ON public.health_data_points(user_id, type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_health_data_high_accuracy ON public.health_data_points(user_id, accuracy DESC) WHERE accuracy >= 80;

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

CREATE INDEX IF NOT EXISTS idx_health_upload_user_unprocessed ON public.health_data_upload(user_id, processed) WHERE processed = false;

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

CREATE INDEX IF NOT EXISTS idx_correlations_user_supplement ON public.health_supplement_correlations(user_id, supplement_id);
CREATE INDEX IF NOT EXISTS idx_correlations_user_metric ON public.health_supplement_correlations(user_id, health_metric);
CREATE INDEX IF NOT EXISTS idx_correlations_significant ON public.health_supplement_correlations(user_id, p_value, confidence_level DESC) WHERE p_value < 0.05;
CREATE INDEX IF NOT EXISTS idx_correlations_high_confidence ON public.health_supplement_correlations(user_id, confidence_level DESC, updated_at DESC) WHERE confidence_level > 70;

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

CREATE INDEX IF NOT EXISTS idx_insights_user_type ON public.health_insights(user_id, insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_active_priority ON public.health_insights(user_id, priority DESC, generated_at DESC) WHERE acknowledged_at IS NULL AND dismissed_at IS NULL;

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

CREATE INDEX IF NOT EXISTS idx_roi_user_supplement ON public.supplement_roi_analysis(user_id, supplement_id);
CREATE INDEX IF NOT EXISTS idx_roi_user_score ON public.supplement_roi_analysis(user_id, roi_score DESC);

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

CREATE INDEX IF NOT EXISTS idx_correlation_jobs_user_status ON public.correlation_jobs(user_id, status, created_at DESC);

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
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_budget_settings_updated_at ON public.budget_settings;
CREATE TRIGGER update_budget_settings_updated_at BEFORE UPDATE ON public.budget_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_user_categories_updated_at ON public.user_categories;
CREATE TRIGGER update_user_categories_updated_at BEFORE UPDATE ON public.user_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_category_items_updated_at ON public.category_items;
CREATE TRIGGER update_category_items_updated_at BEFORE UPDATE ON public.category_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_category_budgets_updated_at ON public.category_budgets;
CREATE TRIGGER update_category_budgets_updated_at BEFORE UPDATE ON public.category_budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_bank_accounts_updated_at ON public.bank_accounts;
CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_budget_categories_updated_at ON public.budget_categories;
CREATE TRIGGER update_budget_categories_updated_at BEFORE UPDATE ON public.budget_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_transaction_items_updated_at ON public.transaction_items;
CREATE TRIGGER update_transaction_items_updated_at BEFORE UPDATE ON public.transaction_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_transaction_rules_updated_at ON public.transaction_rules;
CREATE TRIGGER update_transaction_rules_updated_at BEFORE UPDATE ON public.transaction_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_budget_goals_updated_at ON public.budget_goals;
CREATE TRIGGER update_budget_goals_updated_at BEFORE UPDATE ON public.budget_goals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_recurring_bills_updated_at ON public.recurring_bills;
CREATE TRIGGER update_recurring_bills_updated_at BEFORE UPDATE ON public.recurring_bills FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_bill_payments_updated_at ON public.bill_payments;
CREATE TRIGGER update_bill_payments_updated_at BEFORE UPDATE ON public.bill_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_grocery_budgets_updated_at ON public.grocery_budgets;
CREATE TRIGGER update_grocery_budgets_updated_at BEFORE UPDATE ON public.grocery_budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_protein_targets_updated_at ON public.protein_targets;
CREATE TRIGGER update_protein_targets_updated_at BEFORE UPDATE ON public.protein_targets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_misc_shop_budgets_updated_at ON public.misc_shop_budgets;
CREATE TRIGGER update_misc_shop_budgets_updated_at BEFORE UPDATE ON public.misc_shop_budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_auto_cost_analysis_updated_at ON public.auto_cost_analysis;
CREATE TRIGGER update_auto_cost_analysis_updated_at BEFORE UPDATE ON public.auto_cost_analysis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_health_sync_status_updated_at ON public.health_sync_status;
CREATE TRIGGER update_health_sync_status_updated_at BEFORE UPDATE ON public.health_sync_status FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_correlations_updated_at ON public.health_supplement_correlations;
CREATE TRIGGER update_correlations_updated_at BEFORE UPDATE ON public.health_supplement_correlations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================================
-- PHASE 6.2: NEW TABLES
-- ================================================================================

-- Auto transactions (consolidates gas/maintenance/other)
CREATE TABLE IF NOT EXISTS public.auto_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('gas', 'maintenance', 'other')),
    date DATE NOT NULL,
    mileage INTEGER,
    amount NUMERIC(10,2) NOT NULL,
    description TEXT,
    maintenance_item_id UUID REFERENCES public.maintenance_items(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_transactions_user_date ON public.auto_transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_auto_transactions_user_type ON public.auto_transactions(user_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_auto_transactions_maintenance ON public.auto_transactions(maintenance_item_id) WHERE maintenance_item_id IS NOT NULL;

-- Unified budgets (consolidates all category budgets)
CREATE TABLE IF NOT EXISTS public.unified_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('grocery', 'misc_shopping', 'supplements', 'bills', 'auto', 'custom')),
    budget_amount NUMERIC(10,2) NOT NULL,
    month_year TEXT NOT NULL,
    color_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category, month_year)
);

CREATE INDEX IF NOT EXISTS idx_unified_budgets_user_month ON public.unified_budgets(user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_unified_budgets_user_category ON public.unified_budgets(user_id, category);

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
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;
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
DROP POLICY IF EXISTS "Users can manage their own settings" ON public.user_settings;
CREATE POLICY "Users can manage their own settings" ON public.user_settings FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own budget settings" ON public.budget_settings;
CREATE POLICY "Users can manage their own budget settings" ON public.budget_settings FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own categories" ON public.user_categories;
CREATE POLICY "Users can manage their own categories" ON public.user_categories FOR ALL USING ((select auth.uid()) = user_id);

-- Category System
DROP POLICY IF EXISTS "Users can manage their own category items" ON public.category_items;
CREATE POLICY "Users can manage their own category items" ON public.category_items FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own category logs" ON public.category_logs;
CREATE POLICY "Users can manage their own category logs" ON public.category_logs FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own category budgets" ON public.category_budgets;
CREATE POLICY "Users can manage their own category budgets" ON public.category_budgets FOR ALL USING ((select auth.uid()) = user_id);

-- Supplements
DROP POLICY IF EXISTS "Users can manage their own supplement sections" ON public.supplement_sections;
CREATE POLICY "Users can manage their own supplement sections" ON public.supplement_sections FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own supplements" ON public.supplements;
CREATE POLICY "Users can manage their own supplements" ON public.supplements FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own supplement logs" ON public.supplement_logs;
CREATE POLICY "Users can manage their own supplement logs" ON public.supplement_logs FOR ALL USING ((select auth.uid()) = user_id);

-- Finance
DROP POLICY IF EXISTS "Users can manage their own bank accounts" ON public.bank_accounts;
CREATE POLICY "Users can manage their own bank accounts" ON public.bank_accounts FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own plaid sync cursors" ON public.plaid_sync_cursors;
CREATE POLICY "Users can manage their own plaid sync cursors" ON public.plaid_sync_cursors FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own budget categories" ON public.budget_categories;
CREATE POLICY "Users can manage their own budget categories" ON public.budget_categories FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own transactions" ON public.transactions;
CREATE POLICY "Users can manage their own transactions" ON public.transactions FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own transaction items" ON public.transaction_items;
CREATE POLICY "Users can manage their own transaction items" ON public.transaction_items FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own transaction rules" ON public.transaction_rules;
CREATE POLICY "Users can manage their own transaction rules" ON public.transaction_rules FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can view their own import logs" ON public.import_logs;
CREATE POLICY "Users can view their own import logs" ON public.import_logs FOR SELECT USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can insert their own import logs" ON public.import_logs;
CREATE POLICY "Users can insert their own import logs" ON public.import_logs FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own budget goals" ON public.budget_goals;
CREATE POLICY "Users can manage their own budget goals" ON public.budget_goals FOR ALL USING ((select auth.uid()) = user_id);

-- Bills
DROP POLICY IF EXISTS "Users can manage their own recurring bills" ON public.recurring_bills;
CREATE POLICY "Users can manage their own recurring bills" ON public.recurring_bills FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own bill payments" ON public.bill_payments;
CREATE POLICY "Users can manage their own bill payments" ON public.bill_payments FOR ALL USING ((select auth.uid()) = user_id);

-- Grocery
DROP POLICY IF EXISTS "Users can manage their own grocery budgets" ON public.grocery_budgets;
CREATE POLICY "Users can manage their own grocery budgets" ON public.grocery_budgets FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own grocery purchases" ON public.grocery_purchases;
CREATE POLICY "Users can manage their own grocery purchases" ON public.grocery_purchases FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own protein targets" ON public.protein_targets;
CREATE POLICY "Users can manage their own protein targets" ON public.protein_targets FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own protein calculations" ON public.protein_calculations;
CREATE POLICY "Users can manage their own protein calculations" ON public.protein_calculations FOR ALL USING ((select auth.uid()) = user_id);

-- Misc Shopping
DROP POLICY IF EXISTS "Users can manage their own misc shop budgets" ON public.misc_shop_budgets;
CREATE POLICY "Users can manage their own misc shop budgets" ON public.misc_shop_budgets FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own misc shop purchases" ON public.misc_shop_purchases;
CREATE POLICY "Users can manage their own misc shop purchases" ON public.misc_shop_purchases FOR ALL USING ((select auth.uid()) = user_id);

-- Auto
DROP POLICY IF EXISTS "Users can manage their own gas fillups" ON public.gas_fillups;
CREATE POLICY "Users can manage their own gas fillups" ON public.gas_fillups FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own maintenance items" ON public.maintenance_items;
CREATE POLICY "Users can manage their own maintenance items" ON public.maintenance_items FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own auto cost analysis" ON public.auto_cost_analysis;
CREATE POLICY "Users can manage their own auto cost analysis" ON public.auto_cost_analysis FOR ALL USING ((select auth.uid()) = user_id);

-- Health (Note: health_exports uses TEXT user_id, not UUID)
DROP POLICY IF EXISTS "Users can view their own health exports" ON public.health_exports;
CREATE POLICY "Users can view their own health exports" ON public.health_exports FOR SELECT USING (user_id = auth.uid()::text);
DROP POLICY IF EXISTS "Users can insert their own health exports" ON public.health_exports;
CREATE POLICY "Users can insert their own health exports" ON public.health_exports FOR INSERT WITH CHECK (user_id = auth.uid()::text);
DROP POLICY IF EXISTS "Users can manage their own health data points" ON public.health_data_points;
CREATE POLICY "Users can manage their own health data points" ON public.health_data_points FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own health data uploads" ON public.health_data_upload;
CREATE POLICY "Users can manage their own health data uploads" ON public.health_data_upload FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own health sync status" ON public.health_sync_status;
CREATE POLICY "Users can manage their own health sync status" ON public.health_sync_status FOR ALL USING ((select auth.uid()) = user_id);

-- Health Correlations & Insights
DROP POLICY IF EXISTS "Users can manage their own correlations" ON public.health_supplement_correlations;
CREATE POLICY "Users can manage their own correlations" ON public.health_supplement_correlations FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own insights" ON public.health_insights;
CREATE POLICY "Users can manage their own insights" ON public.health_insights FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own ROI analysis" ON public.supplement_roi_analysis;
CREATE POLICY "Users can manage their own ROI analysis" ON public.supplement_roi_analysis FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own correlation jobs" ON public.correlation_jobs;
CREATE POLICY "Users can manage their own correlation jobs" ON public.correlation_jobs FOR ALL USING ((select auth.uid()) = user_id);

-- ================================================================================
-- BUDGET-HEALTH OPTIMIZATION & SMART QUEUE (Phase 3)
-- ================================================================================

-- Add cost tracking columns to supplements table
ALTER TABLE public.supplements ADD COLUMN IF NOT EXISTS monthly_cost NUMERIC;
ALTER TABLE public.supplements ADD COLUMN IF NOT EXISTS cost_per_serving NUMERIC;
ALTER TABLE public.supplements ADD COLUMN IF NOT EXISTS servings_per_container INTEGER;
ALTER TABLE public.supplements ADD COLUMN IF NOT EXISTS last_purchase_date DATE;
ALTER TABLE public.supplements ADD COLUMN IF NOT EXISTS last_purchase_cost NUMERIC;

-- Health Budget Allocations
CREATE TABLE IF NOT EXISTS public.health_budget_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    monthly_budget NUMERIC NOT NULL CHECK (monthly_budget >= 0),
    health_priority INTEGER NOT NULL CHECK (health_priority >= 1 AND health_priority <= 5),
    roi_target NUMERIC,
    current_spending NUMERIC DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_budget_allocations_user ON public.health_budget_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_allocations_priority ON public.health_budget_allocations(user_id, health_priority DESC);

-- Smart Purchase Queue
CREATE TABLE IF NOT EXISTS public.purchase_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    estimated_cost NUMERIC NOT NULL CHECK (estimated_cost >= 0),
    health_impact_score NUMERIC NOT NULL CHECK (health_impact_score >= 0 AND health_impact_score <= 100),
    affordability_score NUMERIC NOT NULL CHECK (affordability_score >= 0 AND affordability_score <= 100),
    timing_optimality_score NUMERIC NOT NULL CHECK (timing_optimality_score >= 0 AND timing_optimality_score <= 100),
    cost_effectiveness_score NUMERIC NOT NULL CHECK (cost_effectiveness_score >= 0 AND cost_effectiveness_score <= 100),
    urgency_score NUMERIC NOT NULL CHECK (urgency_score >= 0 AND urgency_score <= 100),
    priority_score NUMERIC NOT NULL CHECK (priority_score >= 0 AND priority_score <= 100),
    queue_position INTEGER NOT NULL,
    optimal_purchase_date DATE,
    reasoning TEXT NOT NULL,
    alternative_suggestions JSONB DEFAULT '[]',
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'purchased', 'delayed', 'removed')),
    supplement_id UUID REFERENCES public.supplements(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Phase 6.2: Enhanced queue/funnel/wishlist unification
    purchase_date DATE,
    actual_cost NUMERIC(10,2),
    source TEXT DEFAULT 'misc_shopping'
);

CREATE INDEX IF NOT EXISTS idx_queue_user_position ON public.purchase_queue(user_id, queue_position);
CREATE INDEX IF NOT EXISTS idx_queue_user_status ON public.purchase_queue(user_id, status) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_queue_user_priority ON public.purchase_queue(user_id, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_queue_optimal_date ON public.purchase_queue(user_id, optimal_purchase_date);

-- Purchase Decisions & Outcomes
CREATE TABLE IF NOT EXISTS public.purchase_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    queue_item_id UUID REFERENCES public.purchase_queue(id) ON DELETE SET NULL,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('purchased', 'delayed', 'rejected', 'alternative_chosen')),
    reasoning TEXT NOT NULL,
    confidence_score NUMERIC NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
    estimated_cost NUMERIC,
    actual_cost NUMERIC,
    health_outcome_score NUMERIC CHECK (health_outcome_score >= 0 AND health_outcome_score <= 100),
    satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
    would_purchase_again BOOLEAN,
    outcome_notes TEXT,
    decision_date TIMESTAMPTZ DEFAULT NOW(),
    outcome_date TIMESTAMPTZ,
    alternative_item_name TEXT,
    alternative_cost NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_decisions_user_date ON public.purchase_decisions(user_id, decision_date DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_category ON public.purchase_decisions(user_id, category);
CREATE INDEX IF NOT EXISTS idx_decisions_outcome ON public.purchase_decisions(user_id, decision) WHERE health_outcome_score IS NOT NULL;

-- ================================================================================
-- PHASE 3 HELPER FUNCTIONS
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

-- Function to calculate supplement ROI
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

    -- Calculate total health value from correlations (1% improvement = $1 value)
    SELECT
        SUM(ABS(improvement_percentage) * confidence_level / 100.0),
        COUNT(*)
    INTO v_health_value, v_correlation_count
    FROM health_supplement_correlations
    WHERE user_id = p_user_id
        AND supplement_id = p_supplement_id
        AND p_value < 0.05; -- Only significant correlations

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
-- PHASE 3 TRIGGERS
-- ================================================================================

DROP TRIGGER IF EXISTS update_budget_allocations_updated_at ON public.health_budget_allocations;
CREATE TRIGGER update_budget_allocations_updated_at BEFORE UPDATE ON public.health_budget_allocations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS update_purchase_queue_updated_at ON public.purchase_queue;
CREATE TRIGGER update_purchase_queue_updated_at BEFORE UPDATE ON public.purchase_queue FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================================
-- PHASE 3 ROW LEVEL SECURITY
-- ================================================================================

ALTER TABLE public.health_budget_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_decisions ENABLE ROW LEVEL SECURITY;

-- Phase 6.2: Enable RLS on new tables
ALTER TABLE public.income_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own budget allocations" ON public.health_budget_allocations;
CREATE POLICY "Users can manage their own budget allocations" ON public.health_budget_allocations FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own purchase queue" ON public.purchase_queue;
CREATE POLICY "Users can manage their own purchase queue" ON public.purchase_queue FOR ALL USING ((select auth.uid()) = user_id);
DROP POLICY IF EXISTS "Users can manage their own purchase decisions" ON public.purchase_decisions;
CREATE POLICY "Users can manage their own purchase decisions" ON public.purchase_decisions FOR ALL USING ((select auth.uid()) = user_id);

-- ================================================================================
-- CROSS-POLLINATION: ADD FOREIGN KEY CONSTRAINTS
-- ================================================================================

-- Add FKs to category_items (now that supplements and recurring_bills exist)
ALTER TABLE public.category_items
    ADD CONSTRAINT fk_category_items_supplement
    FOREIGN KEY (supplement_id) REFERENCES public.supplements(id) ON DELETE SET NULL;

ALTER TABLE public.category_items
    ADD CONSTRAINT fk_category_items_recurring_bill
    FOREIGN KEY (recurring_bill_id) REFERENCES public.recurring_bills(id) ON DELETE SET NULL;

-- ================================================================================
-- CROSS-POLLINATION: AUTO-INSIGHTS FROM CORRELATIONS
-- ================================================================================

CREATE OR REPLACE FUNCTION auto_generate_insights_from_correlations()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-create insight for high-confidence correlations
    IF NEW.confidence_level > 80 AND NEW.p_value < 0.05 THEN
        INSERT INTO health_insights (
            user_id,
            insight_type,
            insight_data,
            confidence_score,
            priority
        ) VALUES (
            NEW.user_id,
            'correlation',
            jsonb_build_object(
                'supplement_id', NEW.supplement_id,
                'health_metric', NEW.health_metric,
                'correlation', NEW.correlation_coefficient,
                'improvement_pct', NEW.improvement_percentage,
                'message', CASE
                    WHEN NEW.improvement_percentage > 20 THEN 'Strong positive effect detected'
                    WHEN NEW.improvement_percentage > 10 THEN 'Moderate positive effect detected'
                    WHEN NEW.improvement_percentage < -10 THEN 'Negative effect detected - consider discontinuing'
                    ELSE 'Minor effect detected'
                END
            ),
            NEW.confidence_level / 100.0,
            CASE
                WHEN ABS(NEW.improvement_percentage) > 20 THEN 10
                WHEN ABS(NEW.improvement_percentage) > 10 THEN 7
                ELSE 5
            END
        )
        ON CONFLICT DO NOTHING; -- Prevent duplicates
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_generate_insights
    AFTER INSERT OR UPDATE ON public.health_supplement_correlations
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_insights_from_correlations();

-- ================================================================================
-- CROSS-POLLINATION: MATERIALIZED VIEWS FOR PERFORMANCE
-- ================================================================================

-- Monthly category spending performance (budget vs actual)
CREATE MATERIALIZED VIEW IF NOT EXISTS category_budget_performance AS
SELECT
    cb.user_id,
    cb.category,
    cb.month_year,
    cb.target_amount as budget,
    COALESCE(SUM(cl.actual_amount), 0) as actual_spent,
    cb.target_amount - COALESCE(SUM(cl.actual_amount), 0) as remaining,
    CASE
        WHEN cb.target_amount > 0 THEN (COALESCE(SUM(cl.actual_amount), 0) / cb.target_amount * 100)
        ELSE 0
    END as percent_used,
    cb.is_enabled
FROM category_budgets cb
LEFT JOIN category_items ci ON ci.user_id = cb.user_id AND ci.category = cb.category
LEFT JOIN category_logs cl ON cl.category_item_id = ci.id
    AND TO_CHAR(cl.date, 'YYYY-MM') = cb.month_year
WHERE cb.is_enabled = true
GROUP BY cb.user_id, cb.category, cb.month_year, cb.target_amount, cb.is_enabled;

CREATE INDEX IF NOT EXISTS idx_budget_performance_user_month ON category_budget_performance(user_id, month_year);

-- Daily health data summary (faster queries)
-- Note: Stores ALL historical data, filter by date at query time
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_health_summary AS
SELECT
    user_id,
    DATE(timestamp) as date,
    type,
    AVG(value) as avg_value,
    MIN(value) as min_value,
    MAX(value) as max_value,
    STDDEV(value) as stddev_value,
    COUNT(*) as sample_count,
    AVG(accuracy) as avg_accuracy
FROM health_data_points
GROUP BY user_id, DATE(timestamp), type;

CREATE INDEX IF NOT EXISTS idx_daily_health_user_date ON daily_health_summary(user_id, date DESC, type);

-- Query helper: Get recent health data (last 90 days)
CREATE OR REPLACE FUNCTION get_recent_health_summary(p_user_id UUID, p_days INTEGER DEFAULT 90)
RETURNS TABLE (
    date DATE,
    type TEXT,
    avg_value NUMERIC,
    min_value NUMERIC,
    max_value NUMERIC,
    stddev_value NUMERIC,
    sample_count BIGINT,
    avg_accuracy NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT dhs.date, dhs.type, dhs.avg_value, dhs.min_value, dhs.max_value,
           dhs.stddev_value, dhs.sample_count, dhs.avg_accuracy
    FROM daily_health_summary dhs
    WHERE dhs.user_id = p_user_id
      AND dhs.date > CURRENT_DATE - p_days
    ORDER BY dhs.date DESC, dhs.type;
END;
$$ LANGUAGE plpgsql STABLE;

-- Supplement adherence tracking
-- Note: Stores ALL historical data, filter by date at query time
CREATE MATERIALIZED VIEW IF NOT EXISTS supplement_adherence_summary AS
SELECT
    sl.user_id,
    sl.supplement_id,
    s.name as supplement_name,
    DATE_TRUNC('month', sl.date) as month,
    COUNT(*) FILTER (WHERE sl.is_taken = true) as days_taken,
    COUNT(*) as total_days,
    ROUND(COUNT(*) FILTER (WHERE sl.is_taken = true) * 100.0 / NULLIF(COUNT(*), 0), 1) as adherence_rate,
    MAX(sl.date) as last_logged_date
FROM supplement_logs sl
JOIN supplements s ON s.id = sl.supplement_id
GROUP BY sl.user_id, sl.supplement_id, s.name, DATE_TRUNC('month', sl.date);

CREATE INDEX IF NOT EXISTS idx_adherence_user_supplement ON supplement_adherence_summary(user_id, supplement_id, month DESC);

-- Query helper: Get recent supplement adherence (last 30 days)
CREATE OR REPLACE FUNCTION get_supplement_adherence_30d(p_user_id UUID)
RETURNS TABLE (
    supplement_id UUID,
    supplement_name TEXT,
    days_taken BIGINT,
    total_days BIGINT,
    adherence_rate NUMERIC,
    last_logged_date DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        sl.supplement_id,
        MAX(s.name) as supplement_name,
        COUNT(*) FILTER (WHERE sl.is_taken = true) as days_taken,
        COUNT(*) as total_days,
        ROUND(COUNT(*) FILTER (WHERE sl.is_taken = true) * 100.0 / NULLIF(COUNT(*), 0), 1) as adherence_rate,
        MAX(sl.date) as last_logged_date
    FROM supplement_logs sl
    JOIN supplements s ON s.id = sl.supplement_id
    WHERE sl.user_id = p_user_id
      AND sl.date > CURRENT_DATE - 30
    GROUP BY sl.supplement_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Auto cost analysis (auto-calculated from gas fillups)
-- Note: Pre-aggregated by month for all historical data
CREATE MATERIALIZED VIEW IF NOT EXISTS auto_cost_summary AS
SELECT
    user_id,
    DATE_TRUNC('month', date) as month,
    COUNT(*) as fillup_count,
    SUM(gallons) as total_gallons,
    SUM(cost) as total_fuel_cost,
    AVG(price_per_gallon) as avg_gas_price,
    AVG(mpg) as avg_mpg,
    MAX(mileage) - MIN(mileage) as miles_driven,
    CASE
        WHEN MAX(mileage) - MIN(mileage) > 0
        THEN SUM(cost) / (MAX(mileage) - MIN(mileage))
        ELSE NULL
    END as cost_per_mile
FROM gas_fillups
GROUP BY user_id, DATE_TRUNC('month', date);

CREATE INDEX IF NOT EXISTS idx_auto_cost_user_month ON auto_cost_summary(user_id, month DESC);

-- Query helper: Get recent auto costs (last 12 months)
CREATE OR REPLACE FUNCTION get_auto_costs_12mo(p_user_id UUID)
RETURNS TABLE (
    month TIMESTAMPTZ,
    fillup_count BIGINT,
    total_gallons NUMERIC,
    total_fuel_cost NUMERIC,
    avg_gas_price NUMERIC,
    avg_mpg NUMERIC,
    miles_driven NUMERIC,
    cost_per_mile NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT acs.month, acs.fillup_count, acs.total_gallons, acs.total_fuel_cost,
           acs.avg_gas_price, acs.avg_mpg, acs.miles_driven, acs.cost_per_mile
    FROM auto_cost_summary acs
    WHERE acs.user_id = p_user_id
      AND acs.month > DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '12 months'
    ORDER BY acs.month DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Supplement ROI summary (combines cost + health benefit)
CREATE MATERIALIZED VIEW IF NOT EXISTS supplement_roi_summary AS
SELECT
    s.user_id,
    s.id as supplement_id,
    s.name as supplement_name,
    s.cost,
    s.monthly_cost,
    COUNT(DISTINCT hsc.health_metric) as metrics_affected,
    AVG(hsc.improvement_percentage) FILTER (WHERE hsc.p_value < 0.05) as avg_improvement,
    MAX(hsc.confidence_level) as max_confidence,
    CASE
        WHEN s.monthly_cost > 0 AND AVG(hsc.improvement_percentage) FILTER (WHERE hsc.p_value < 0.05) > 0
        THEN AVG(hsc.improvement_percentage) FILTER (WHERE hsc.p_value < 0.05) / s.monthly_cost
        ELSE 0
    END as roi_ratio
FROM supplements s
LEFT JOIN health_supplement_correlations hsc ON hsc.supplement_id = s.id
WHERE s.cost IS NOT NULL OR s.monthly_cost IS NOT NULL
GROUP BY s.user_id, s.id, s.name, s.cost, s.monthly_cost;

CREATE INDEX IF NOT EXISTS idx_supplement_roi_user_roi ON supplement_roi_summary(user_id, roi_ratio DESC NULLS LAST);

-- ================================================================================
-- REFRESH FUNCTIONS FOR MATERIALIZED VIEWS
-- ================================================================================

CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY category_budget_performance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_health_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY supplement_adherence_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY auto_cost_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY supplement_roi_summary;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh specific user's views (faster)
CREATE OR REPLACE FUNCTION refresh_user_views(p_user_id UUID)
RETURNS void AS $$
BEGIN
    -- Note: CONCURRENTLY doesn't support WHERE clauses, so full refresh needed
    -- In production, consider partitioning or incremental updates
    PERFORM refresh_all_materialized_views();
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- PHASE 6: ADDITIONAL COMPOSITE INDEXES AND UNIQUE CONSTRAINTS
-- ================================================================================

-- Composite indexes for query performance
CREATE INDEX IF NOT EXISTS idx_recurring_bills_user_active ON public.recurring_bills(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_protein_calculations_user_created ON public.protein_calculations(user_id, created_at);
-- misc_shop_purchases already has idx_misc_shop_purchases_user_date index
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_active ON public.bank_accounts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_bill_payments_user_date ON public.bill_payments(user_id, date);
CREATE INDEX IF NOT EXISTS idx_grocery_purchases_user_date ON public.grocery_purchases(user_id, date);

-- Unique constraints for single-row-per-user tables (required for .single() queries)
ALTER TABLE public.grocery_budgets DROP CONSTRAINT IF EXISTS unique_grocery_budgets_user;
ALTER TABLE public.grocery_budgets ADD CONSTRAINT unique_grocery_budgets_user UNIQUE (user_id);

ALTER TABLE public.protein_targets DROP CONSTRAINT IF EXISTS unique_protein_targets_user;
ALTER TABLE public.protein_targets ADD CONSTRAINT unique_protein_targets_user UNIQUE (user_id);

ALTER TABLE public.misc_shop_budgets DROP CONSTRAINT IF EXISTS unique_misc_shop_budgets_user;
ALTER TABLE public.misc_shop_budgets ADD CONSTRAINT unique_misc_shop_budgets_user UNIQUE (user_id);

-- user_settings already has UNIQUE constraint via table definition

-- ================================================================================
-- PHASE 6.2: RLS POLICIES FOR NEW TABLES
-- ================================================================================

-- Income settings policies
DROP POLICY IF EXISTS "Users can manage their own income settings" ON public.income_settings;
CREATE POLICY "Users can manage their own income settings" ON public.income_settings FOR ALL USING ((select auth.uid()) = user_id);

-- Supplement purchases policies
DROP POLICY IF EXISTS "Users can manage their own supplement purchases" ON public.supplement_purchases;
CREATE POLICY "Users can manage their own supplement purchases" ON public.supplement_purchases FOR ALL USING ((select auth.uid()) = user_id);

-- Supplement budgets policies
DROP POLICY IF EXISTS "Users can manage their own supplement budgets" ON public.supplement_budgets;
CREATE POLICY "Users can manage their own supplement budgets" ON public.supplement_budgets FOR ALL USING ((select auth.uid()) = user_id);

-- Favorite foods policies
DROP POLICY IF EXISTS "Users can manage their own favorite foods" ON public.favorite_foods;
CREATE POLICY "Users can manage their own favorite foods" ON public.favorite_foods FOR ALL USING ((select auth.uid()) = user_id);

-- Auto transactions policies
DROP POLICY IF EXISTS "Users can manage their own auto transactions" ON public.auto_transactions;
CREATE POLICY "Users can manage their own auto transactions" ON public.auto_transactions FOR ALL USING ((select auth.uid()) = user_id);

-- Unified budgets policies
DROP POLICY IF EXISTS "Users can manage their own unified budgets" ON public.unified_budgets;
CREATE POLICY "Users can manage their own unified budgets" ON public.unified_budgets FOR ALL USING ((select auth.uid()) = user_id);
