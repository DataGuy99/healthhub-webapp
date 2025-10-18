-- ============================================================================
-- Phase 6.2 - UX Restructuring SQL Migration
-- Date: 2025-10-18
-- Description: Schema changes to support UX improvements based on user feedback
-- ============================================================================

-- ============================================================================
-- 1. BILLS RESTRUCTURING
-- ============================================================================

-- Add flexible recurrence and income tracking to recurring_bills
ALTER TABLE IF EXISTS public.recurring_bills
  ADD COLUMN IF NOT EXISTS recurrence_type TEXT DEFAULT 'monthly'
    CHECK (recurrence_type IN ('monthly', 'weekly', 'biweekly', 'custom')),
  ADD COLUMN IF NOT EXISTS recurrence_config JSONB,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS is_income BOOLEAN DEFAULT FALSE;

-- Add comments to explain recurrence_config JSON structure
COMMENT ON COLUMN public.recurring_bills.recurrence_config IS 'Flexible recurrence configuration. Examples:
- Weekly on specific days excluding first week: {"day_of_week": 5, "exclude_week_numbers": [1]}
- 1st and 15th of month: {"days_of_month": [1, 15]}
- Biweekly starting on specific date: {"start_date": "2025-01-01", "interval_weeks": 2}';

-- Create income settings table
CREATE TABLE IF NOT EXISTS public.income_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_tax_hourly_rate NUMERIC(10,2),
  hours_per_week NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================================
-- 2. MISC SHOPPING RESTRUCTURING
-- ============================================================================

-- Remove needs/wants distinction from misc_shop_purchases
ALTER TABLE IF EXISTS public.misc_shop_purchases
  DROP COLUMN IF EXISTS is_big_purchase,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'misc';

-- Enhance purchase_queue to unify queue/funnel/wishlist
ALTER TABLE IF EXISTS public.purchase_queue
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'queue'
    CHECK (status IN ('queue', 'funnel', 'purchased', 'removed')),
  ADD COLUMN IF NOT EXISTS priority_score NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS purchase_date DATE,
  ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'misc_shopping';

-- ============================================================================
-- 3. AUTO RESTRUCTURING
-- ============================================================================

-- Enhance maintenance_items with projected maintenance tracking
ALTER TABLE IF EXISTS public.maintenance_items
  ADD COLUMN IF NOT EXISTS is_projected BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS projected_interval_miles INTEGER,
  ADD COLUMN IF NOT EXISTS last_completed_mileage INTEGER,
  ADD COLUMN IF NOT EXISTS next_due_mileage INTEGER,
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completed_date DATE;

COMMENT ON COLUMN public.maintenance_items.projected_interval_miles IS 'Interval in miles for recurring maintenance (e.g., 3000 for oil changes, 50000 for major service)';

-- Create unified auto_transactions table
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

-- ============================================================================
-- 4. SUPPLEMENTS ENHANCEMENTS
-- ============================================================================

-- Add complex frequency patterns, links, and purchase tracking to supplements
ALTER TABLE IF EXISTS public.supplements
  ADD COLUMN IF NOT EXISTS frequency_type TEXT DEFAULT 'daily'
    CHECK (frequency_type IN ('daily', 'weekly', 'alternating', 'cyclic', 'custom')),
  ADD COLUMN IF NOT EXISTS frequency_config JSONB,
  ADD COLUMN IF NOT EXISTS product_url TEXT,
  ADD COLUMN IF NOT EXISTS cost_per_container NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS servings_per_container INTEGER,
  ADD COLUMN IF NOT EXISTS last_purchase_date DATE,
  ADD COLUMN IF NOT EXISTS is_in_stock BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN public.supplements.frequency_config IS 'Complex frequency configuration. Examples:
- Daily: {"times_per_day": 2}
- Weekly: {"days_of_week": [0,2,4], "times_per_day": 1} (Sun, Tue, Thu)
- Alternating: {"pattern": "on_off", "times_per_day": 1} (alternating days)
- Cyclic: {"days_on": 2, "days_off": 5, "times_per_day": 1}
- Custom calendar: {"calendar": {"2025-10": [1,5,10,15]}}';

-- Create supplement purchase tracking table
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

-- Create supplement budget table
CREATE TABLE IF NOT EXISTS public.supplement_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_amount NUMERIC(10,2) NOT NULL,
  month_year TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

-- ============================================================================
-- 5. GROCERY ENHANCEMENTS
-- ============================================================================

-- Create favorite_foods table (replaces "common purchases" concept)
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

COMMENT ON COLUMN public.favorite_foods.macros IS 'Additional macro information as JSON: {"carbs": 50, "fat": 10, "calories": 300}';

-- Enhance grocery_purchases with quantity and favorite reference
ALTER TABLE IF EXISTS public.grocery_purchases
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS favorite_food_id UUID REFERENCES public.favorite_foods(id),
  ADD COLUMN IF NOT EXISTS carbs_grams NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS fat_grams NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS calories NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS servings INTEGER;

-- ============================================================================
-- 6. CONSOLIDATED BUDGET MANAGEMENT
-- ============================================================================

-- Create unified budgets table
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

COMMENT ON TABLE public.unified_budgets IS 'Consolidated budget management system for all categories. Replaces individual category budget tables.';

COMMENT ON COLUMN public.unified_budgets.color_code IS 'Consistent color across charts and graphs (hex code, e.g., #FF5733)';

-- ============================================================================
-- 7. INDEXES FOR NEW TABLES AND COLUMNS
-- ============================================================================

-- Income settings (already unique on user_id)
CREATE INDEX IF NOT EXISTS idx_income_settings_user ON public.income_settings(user_id);

-- Auto transactions
CREATE INDEX IF NOT EXISTS idx_auto_transactions_user_date ON public.auto_transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_auto_transactions_user_type ON public.auto_transactions(user_id, transaction_type);
CREATE INDEX IF NOT EXISTS idx_auto_transactions_maintenance ON public.auto_transactions(maintenance_item_id) WHERE maintenance_item_id IS NOT NULL;

-- Maintenance items projected
CREATE INDEX IF NOT EXISTS idx_maintenance_items_projected ON public.maintenance_items(user_id, is_projected, next_due_mileage) WHERE is_projected = TRUE;

-- Purchase queue status
CREATE INDEX IF NOT EXISTS idx_purchase_queue_user_status ON public.purchase_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_queue_user_source ON public.purchase_queue(user_id, source);

-- Supplement purchases
CREATE INDEX IF NOT EXISTS idx_supplement_purchases_user_date ON public.supplement_purchases(user_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_supplement_purchases_supplement ON public.supplement_purchases(supplement_id);

-- Supplement budgets (already unique on user_id, month_year)
CREATE INDEX IF NOT EXISTS idx_supplement_budgets_user_month ON public.supplement_budgets(user_id, month_year);

-- Favorite foods (already unique on user_id, item_name)
CREATE INDEX IF NOT EXISTS idx_favorite_foods_user ON public.favorite_foods(user_id);

-- Grocery purchases favorite reference
CREATE INDEX IF NOT EXISTS idx_grocery_purchases_favorite ON public.grocery_purchases(favorite_food_id) WHERE favorite_food_id IS NOT NULL;

-- Unified budgets (already unique on user_id, category, month_year)
CREATE INDEX IF NOT EXISTS idx_unified_budgets_user_month ON public.unified_budgets(user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_unified_budgets_user_category ON public.unified_budgets(user_id, category);

-- Recurring bills enhanced
CREATE INDEX IF NOT EXISTS idx_recurring_bills_income ON public.recurring_bills(user_id, is_income) WHERE is_income = TRUE;

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.income_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplement_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_budgets ENABLE ROW LEVEL SECURITY;

-- Income settings policies
CREATE POLICY IF NOT EXISTS "Users can view their own income settings"
  ON public.income_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own income settings"
  ON public.income_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own income settings"
  ON public.income_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own income settings"
  ON public.income_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Auto transactions policies
CREATE POLICY IF NOT EXISTS "Users can view their own auto transactions"
  ON public.auto_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own auto transactions"
  ON public.auto_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own auto transactions"
  ON public.auto_transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own auto transactions"
  ON public.auto_transactions FOR DELETE
  USING (auth.uid() = user_id);

-- Supplement purchases policies
CREATE POLICY IF NOT EXISTS "Users can view their own supplement purchases"
  ON public.supplement_purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own supplement purchases"
  ON public.supplement_purchases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own supplement purchases"
  ON public.supplement_purchases FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own supplement purchases"
  ON public.supplement_purchases FOR DELETE
  USING (auth.uid() = user_id);

-- Supplement budgets policies
CREATE POLICY IF NOT EXISTS "Users can view their own supplement budgets"
  ON public.supplement_budgets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own supplement budgets"
  ON public.supplement_budgets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own supplement budgets"
  ON public.supplement_budgets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own supplement budgets"
  ON public.supplement_budgets FOR DELETE
  USING (auth.uid() = user_id);

-- Favorite foods policies
CREATE POLICY IF NOT EXISTS "Users can view their own favorite foods"
  ON public.favorite_foods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own favorite foods"
  ON public.favorite_foods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own favorite foods"
  ON public.favorite_foods FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own favorite foods"
  ON public.favorite_foods FOR DELETE
  USING (auth.uid() = user_id);

-- Unified budgets policies
CREATE POLICY IF NOT EXISTS "Users can view their own unified budgets"
  ON public.unified_budgets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own unified budgets"
  ON public.unified_budgets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own unified budgets"
  ON public.unified_budgets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own unified budgets"
  ON public.unified_budgets FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 9. DATA MIGRATION HELPERS (Optional - for existing data)
-- ============================================================================

-- Migrate existing misc_shop_budgets to unified_budgets
-- (Run manually after testing if you want to preserve existing budgets)
/*
INSERT INTO public.unified_budgets (user_id, category, budget_amount, month_year, created_at)
SELECT user_id, 'misc_shopping', budget_amount, month, created_at
FROM public.misc_shop_budgets
ON CONFLICT (user_id, category, month_year) DO NOTHING;
*/

-- Migrate existing grocery_budgets to unified_budgets
/*
INSERT INTO public.unified_budgets (user_id, category, budget_amount, month_year, created_at)
SELECT user_id, 'grocery', budget_amount, month, created_at
FROM public.grocery_budgets
ON CONFLICT (user_id, category, month_year) DO NOTHING;
*/

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
