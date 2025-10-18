-- Migration: Consolidate all budget/spending data to category_logs and category_budgets
-- This fixes the fragmented budget system where spending was split across multiple tables

-- ================================================================================
-- STEP 1: Migrate misc_shop_purchases to category_logs
-- ================================================================================

-- Create a mapping: misc_shop_purchases -> category_logs
-- Each misc purchase becomes a category_log entry with category derived from purchase.category
INSERT INTO public.category_logs (user_id, category_item_id, date, actual_amount, notes, timestamp, is_planned)
SELECT
    user_id,
    NULL AS category_item_id,  -- One-off purchases don't need a category_item
    date,
    amount AS actual_amount,
    COALESCE(item_name || '. ' || notes, item_name) AS notes,  -- Combine item name and notes
    created_at AS timestamp,
    false AS is_planned  -- These are actual purchases, not planned
FROM public.misc_shop_purchases
WHERE NOT EXISTS (
    -- Prevent duplicates if migration is run multiple times
    SELECT 1 FROM public.category_logs cl
    WHERE cl.user_id = misc_shop_purchases.user_id
    AND cl.date = misc_shop_purchases.date
    AND cl.actual_amount = misc_shop_purchases.amount
    AND cl.notes LIKE misc_shop_purchases.item_name || '%'
);

-- ================================================================================
-- STEP 2: Migrate grocery_purchases to category_logs
-- ================================================================================

-- Grocery purchases -> category_logs with category='groceries'
INSERT INTO public.category_logs (user_id, category_item_id, date, actual_amount, notes, timestamp, is_planned)
SELECT
    user_id,
    NULL AS category_item_id,
    date,
    amount AS actual_amount,
    CONCAT(
        'Grocery: ', store,
        CASE WHEN protein_grams IS NOT NULL THEN ', ' || protein_grams || 'g protein' ELSE '' END,
        CASE WHEN notes IS NOT NULL THEN '. ' || notes ELSE '' END
    ) AS notes,
    created_at AS timestamp,
    false AS is_planned
FROM public.grocery_purchases
WHERE NOT EXISTS (
    SELECT 1 FROM public.category_logs cl
    WHERE cl.user_id = grocery_purchases.user_id
    AND cl.date = grocery_purchases.date
    AND cl.actual_amount = grocery_purchases.amount
    AND cl.notes LIKE 'Grocery: ' || grocery_purchases.store || '%'
);

-- ================================================================================
-- STEP 3: Migrate supplement_purchases to category_logs
-- ================================================================================

-- Supplement purchases -> category_logs with reference to supplement via notes
INSERT INTO public.category_logs (user_id, category_item_id, date, actual_amount, notes, timestamp, is_planned)
SELECT
    sp.user_id,
    NULL AS category_item_id,
    sp.purchase_date AS date,
    sp.cost AS actual_amount,
    CONCAT(
        'Supplement: ', COALESCE(s.name, 'Unknown'),
        CASE WHEN sp.quantity > 1 THEN ' (qty: ' || sp.quantity || ')' ELSE '' END,
        CASE WHEN sp.notes IS NOT NULL THEN '. ' || sp.notes ELSE '' END
    ) AS notes,
    sp.created_at AS timestamp,
    false AS is_planned
FROM public.supplement_purchases sp
LEFT JOIN public.supplements s ON sp.supplement_id = s.id
WHERE NOT EXISTS (
    SELECT 1 FROM public.category_logs cl
    WHERE cl.user_id = sp.user_id
    AND cl.date = sp.purchase_date
    AND cl.actual_amount = sp.cost
    AND cl.notes LIKE 'Supplement:%'
);

-- ================================================================================
-- STEP 4: Migrate budget settings to category_budgets
-- ================================================================================

-- Migrate misc_shop_budgets to category_budgets
-- Note: misc_shop_budgets has monthly_budget (not per-month), so we create entries for current year
DO $$
DECLARE
    budget_record RECORD;
    month_iter INTEGER;
    current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
BEGIN
    FOR budget_record IN
        SELECT user_id, monthly_budget
        FROM public.misc_shop_budgets
        WHERE monthly_budget > 0
    LOOP
        -- Create budget entries for each month of current year
        FOR month_iter IN 1..12 LOOP
            INSERT INTO public.category_budgets (user_id, category, month_year, target_amount, notes, is_enabled)
            VALUES (
                budget_record.user_id,
                'misc',
                current_year || '-' || LPAD(month_iter::TEXT, 2, '0'),
                budget_record.monthly_budget,
                'Migrated from misc_shop_budgets',
                true
            )
            ON CONFLICT (user_id, category, month_year) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- Migrate grocery_budgets to category_budgets (weekly -> monthly conversion)
DO $$
DECLARE
    budget_record RECORD;
    month_iter INTEGER;
    current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
    monthly_amount NUMERIC;
BEGIN
    FOR budget_record IN
        SELECT user_id, weekly_budget
        FROM public.grocery_budgets
        WHERE weekly_budget > 0
    LOOP
        -- Convert weekly to monthly (weekly * 52 / 12 = ~4.33 weeks per month)
        monthly_amount := budget_record.weekly_budget * 4.33;

        FOR month_iter IN 1..12 LOOP
            INSERT INTO public.category_budgets (user_id, category, month_year, target_amount, notes, is_enabled)
            VALUES (
                budget_record.user_id,
                'groceries',
                current_year || '-' || LPAD(month_iter::TEXT, 2, '0'),
                monthly_amount,
                'Migrated from grocery_budgets (weekly: $' || budget_record.weekly_budget || ')',
                true
            )
            ON CONFLICT (user_id, category, month_year) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- Migrate supplement_budgets to category_budgets
INSERT INTO public.category_budgets (user_id, category, month_year, target_amount, notes, is_enabled)
SELECT
    user_id,
    'supplements' AS category,
    month_year,
    budget_amount AS target_amount,
    'Migrated from supplement_budgets' AS notes,
    true AS is_enabled
FROM public.supplement_budgets
ON CONFLICT (user_id, category, month_year) DO NOTHING;

-- ================================================================================
-- STEP 5: Add metadata columns to track migration (optional, for safety)
-- ================================================================================

-- Add a column to old tables to mark them as migrated
ALTER TABLE public.misc_shop_purchases ADD COLUMN IF NOT EXISTS migrated_to_category_logs BOOLEAN DEFAULT false;
ALTER TABLE public.grocery_purchases ADD COLUMN IF NOT EXISTS migrated_to_category_logs BOOLEAN DEFAULT false;
ALTER TABLE public.supplement_purchases ADD COLUMN IF NOT EXISTS migrated_to_category_logs BOOLEAN DEFAULT false;

-- Mark all existing rows as migrated
UPDATE public.misc_shop_purchases SET migrated_to_category_logs = true;
UPDATE public.grocery_purchases SET migrated_to_category_logs = true;
UPDATE public.supplement_purchases SET migrated_to_category_logs = true;

-- ================================================================================
-- VERIFICATION QUERIES (run these manually to verify)
-- ================================================================================

-- Count migrated records:
-- SELECT COUNT(*) FROM category_logs WHERE notes LIKE 'Grocery:%';
-- SELECT COUNT(*) FROM category_logs WHERE notes LIKE 'Supplement:%';
-- SELECT COUNT(*) FROM category_logs WHERE notes NOT LIKE 'Grocery:%' AND notes NOT LIKE 'Supplement:%';

-- Check budget consolidation:
-- SELECT category, COUNT(*) FROM category_budgets GROUP BY category ORDER BY category;
