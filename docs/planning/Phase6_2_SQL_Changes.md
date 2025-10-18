# Phase 6.2 - SQL Schema Changes for UX Restructuring

Date: 2025-10-18
Author: Claude Code

## Overview

This document outlines all SQL schema changes needed to support the Phase 6.2 UX restructuring based on user feedback.

## 1. Remove Home & Garden + Investments

**Action:** These categories are "so far behind they may as well not be there"

**Schema Changes:**
- No dedicated tables exist (handled via user_categories system)
- Will handle removal in frontend by excluding these templates/categories
- No SQL changes needed for removal

**SQL:** None required (frontend-only change)

---

## 2. Bills Restructuring

**Requirements:**
- Providers should auto-populate from bill names when adding to calendar
- Payment tracker should register payments when marked off on calendar
- Add income tracking capability
- Flexible recurring logic (e.g., "every Friday except first Friday of month")
- Income calculator: hours needed to cover expenses based on post-tax hourly rate

**Current Schema:**
```sql
CREATE TABLE recurring_bills (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  due_date INTEGER NOT NULL,  -- day of month
  category TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE bill_payments (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  bill_id UUID REFERENCES recurring_bills(id),
  date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  notes TEXT
);
```

**New Schema:**
```sql
-- Enhanced recurring_bills with flexible recurrence
ALTER TABLE recurring_bills
  ADD COLUMN IF NOT EXISTS recurrence_type TEXT DEFAULT 'monthly'
    CHECK (recurrence_type IN ('monthly', 'weekly', 'biweekly', 'custom')),
  ADD COLUMN IF NOT EXISTS recurrence_config JSONB,
  -- Example recurrence_config for "every Friday except first Friday":
  -- {"day_of_week": 5, "exclude_week_numbers": [1]}
  -- Example for "1st and 15th of month":
  -- {"days_of_month": [1, 15]}
  ADD COLUMN IF NOT EXISTS provider TEXT,  -- Auto-populated from name
  ADD COLUMN IF NOT EXISTS is_income BOOLEAN DEFAULT FALSE;

-- Income tracking settings
CREATE TABLE IF NOT EXISTS public.income_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_tax_hourly_rate NUMERIC(10,2),
  hours_per_week NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

---

## 3. Misc Shopping Restructuring

**Requirements:**
- Wishlist = Queue/Funnel (consolidate)
- Remove needs/wants distinction
- Fix budget tracker to register purchases
- Smaller budget setting window
- Unify queue and funnel into single system

**Current Schema:**
```sql
CREATE TABLE misc_shop_budgets (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  budget_amount NUMERIC(10,2),
  month TEXT
);

CREATE TABLE misc_shop_purchases (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL,
  is_big_purchase BOOLEAN DEFAULT FALSE,
  notes TEXT
);

CREATE TABLE purchase_queue (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  estimated_cost NUMERIC(10,2),
  priority INTEGER DEFAULT 5,
  category TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**New Schema:**
```sql
-- Remove is_big_purchase (obsolete needs/wants distinction)
ALTER TABLE misc_shop_purchases
  DROP COLUMN IF EXISTS is_big_purchase,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'misc';

-- Enhanced purchase_queue (unified queue/funnel/wishlist)
ALTER TABLE purchase_queue
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'queue'
    CHECK (status IN ('queue', 'funnel', 'purchased', 'removed')),
  ADD COLUMN IF NOT EXISTS priority_score NUMERIC(5,2),  -- Calculated funnel score
  ADD COLUMN IF NOT EXISTS purchase_date DATE,
  ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'misc_shopping';  -- misc_shopping, supplements, grocery, etc.
```

---

## 4. Auto Restructuring

**Requirements:**
- Consolidate costs + maintenance (remove separate subtabs)
- Projected maintenance every X miles
- Single gas fillup form (price/gal, mileage, amount filled, total cost)
- Remove want/need classifiers
- Remove description requirement for gas events
- MPG tracker moves to overview (frontend change)

**Current Schema:**
```sql
CREATE TABLE gas_fillups (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  mileage INTEGER NOT NULL,
  gallons NUMERIC(6,2) NOT NULL,
  price_per_gallon NUMERIC(6,3) NOT NULL,
  total_cost NUMERIC(10,2) NOT NULL,
  notes TEXT
);

CREATE TABLE maintenance_items (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  cost NUMERIC(10,2),
  mileage INTEGER,
  date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT
);

CREATE TABLE auto_cost_analysis (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_gas_cost NUMERIC(10,2),
  total_maintenance_cost NUMERIC(10,2),
  avg_mpg NUMERIC(6,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**New Schema:**
```sql
-- Simplify gas_fillups (remove unnecessary notes requirement)
-- No changes needed - notes already optional

-- Enhanced maintenance_items with projected maintenance
ALTER TABLE maintenance_items
  ADD COLUMN IF NOT EXISTS is_projected BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS projected_interval_miles INTEGER,  -- e.g., 3000 for oil change
  ADD COLUMN IF NOT EXISTS last_completed_mileage INTEGER,
  ADD COLUMN IF NOT EXISTS next_due_mileage INTEGER,
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completed_date DATE;

-- Unified auto_transactions (replaces separate costs/maintenance)
CREATE TABLE IF NOT EXISTS public.auto_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('gas', 'maintenance', 'other')),
  date DATE NOT NULL,
  mileage INTEGER,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  maintenance_item_id UUID REFERENCES maintenance_items(id),  -- Link to projected maintenance
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. Supplements Enhancements

**Requirements:**
- Complex frequency patterns (alternating days, 2 on/5 off, specific days of week, custom calendar)
- Link field for product URLs
- Purchase tracking against budget
- Budget management
- Toggle supplements on/off (out of stock)
- Mark supplements as purchased
- Collapse taken supplements feature (frontend)

**Current Schema:**
```sql
CREATE TABLE supplements (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  section UUID REFERENCES supplement_sections(id),
  name TEXT NOT NULL,
  brand TEXT,
  dosage TEXT,
  frequency_per_day INTEGER DEFAULT 1,
  time_of_day TEXT,
  "order" INTEGER DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE supplement_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  supplement_id UUID REFERENCES supplements(id),
  date DATE NOT NULL,
  taken BOOLEAN DEFAULT FALSE,
  notes TEXT
);
```

**New Schema:**
```sql
ALTER TABLE supplements
  ADD COLUMN IF NOT EXISTS frequency_type TEXT DEFAULT 'daily'
    CHECK (frequency_type IN ('daily', 'weekly', 'alternating', 'cyclic', 'custom')),
  ADD COLUMN IF NOT EXISTS frequency_config JSONB,
  -- Examples:
  -- Daily: {"times_per_day": 2}
  -- Weekly: {"days_of_week": [0,2,4], "times_per_day": 1}  -- Sun, Tue, Thu
  -- Alternating: {"pattern": "on_off", "times_per_day": 1}  -- alternating days
  -- Cyclic: {"days_on": 2, "days_off": 5, "times_per_day": 1}
  -- Custom: {"calendar": {"2025-10": [1,5,10,15]}}  -- specific dates
  ADD COLUMN IF NOT EXISTS product_url TEXT,
  ADD COLUMN IF NOT EXISTS cost_per_container NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS servings_per_container INTEGER,
  ADD COLUMN IF NOT EXISTS last_purchase_date DATE,
  ADD COLUMN IF NOT EXISTS is_in_stock BOOLEAN DEFAULT TRUE;

-- Supplement purchase tracking
CREATE TABLE IF NOT EXISTS public.supplement_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplement_id UUID REFERENCES supplements(id) ON DELETE CASCADE,
  purchase_date DATE NOT NULL,
  cost NUMERIC(10,2) NOT NULL,
  quantity INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supplement budget
CREATE TABLE IF NOT EXISTS public.supplement_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  budget_amount NUMERIC(10,2) NOT NULL,
  month_year TEXT NOT NULL,  -- e.g., "2025-10"
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);
```

---

## 6. Grocery Enhancements

**Requirements:**
- "Add to favorites" button in protein calculator
- Rename "common purchases" to "favorite foods"
- Quick buy feature with one-off purchases
- Number selector for favorited items
- Mark as bought against shopping budget
- Remove redundant Items subtab
- Remove redundant Costs subtab

**Current Schema:**
```sql
CREATE TABLE grocery_budgets (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  budget_amount NUMERIC(10,2),
  month TEXT
);

CREATE TABLE grocery_purchases (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  protein_grams NUMERIC(8,2),
  date DATE NOT NULL,
  notes TEXT
);

CREATE TABLE protein_calculations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  total_cost NUMERIC(10,2),
  protein_grams NUMERIC(8,2),
  cost_per_gram NUMERIC(10,4),
  servings INTEGER,
  serving_size_oz NUMERIC(6,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**New Schema:**
```sql
-- Favorite foods (replaces common purchases concept)
CREATE TABLE IF NOT EXISTS public.favorite_foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  total_cost NUMERIC(10,2) NOT NULL,
  protein_grams NUMERIC(8,2),
  cost_per_gram NUMERIC(10,4),
  servings INTEGER,
  serving_size_oz NUMERIC(6,2),
  macros JSONB,  -- {"carbs": 50, "fat": 10, "calories": 300}
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_name)
);

-- Enhanced grocery_purchases with quantity and favorite reference
ALTER TABLE grocery_purchases
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS favorite_food_id UUID REFERENCES favorite_foods(id),
  ADD COLUMN IF NOT EXISTS carbs_grams NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS fat_grams NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS calories NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS servings INTEGER;
```

---

## 7. Consolidated Budget Management

**Requirements:**
- Single view for all category budgets
- Consolidated budget entry and management
- Pull budget logic from centralized location
- Color-coded line graph broken down by category

**New Schema:**
```sql
-- Unified budget system (consolidates grocery_budgets, misc_shop_budgets, supplement_budgets, etc.)
CREATE TABLE IF NOT EXISTS public.unified_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('grocery', 'misc_shopping', 'supplements', 'bills', 'auto', 'custom')),
  budget_amount NUMERIC(10,2) NOT NULL,
  month_year TEXT NOT NULL,  -- e.g., "2025-10"
  color_code TEXT,  -- For consistent color across charts
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category, month_year)
);

-- Budget summary view (for performance)
CREATE OR REPLACE VIEW public.budget_summary AS
SELECT
  user_id,
  category,
  month_year,
  budget_amount,
  COALESCE(spent_amount, 0) as spent_amount,
  (budget_amount - COALESCE(spent_amount, 0)) as remaining_amount
FROM unified_budgets ub
LEFT JOIN LATERAL (
  SELECT SUM(amount) as spent_amount
  FROM (
    -- Grocery purchases
    SELECT user_id, date, amount FROM grocery_purchases WHERE user_id = ub.user_id AND category = 'grocery'
    UNION ALL
    -- Misc shopping
    SELECT user_id, date, amount FROM misc_shop_purchases WHERE user_id = ub.user_id AND category = 'misc_shopping'
    UNION ALL
    -- Supplement purchases
    SELECT user_id, purchase_date as date, cost as amount FROM supplement_purchases WHERE user_id = ub.user_id AND category = 'supplements'
    -- Add other categories as needed
  ) all_purchases
  WHERE TO_CHAR(date, 'YYYY-MM') = ub.month_year
) purchases ON TRUE;
```

---

## Migration Order

1. **Backup current database**
2. **Run Phase 6.2 Schema Updates:**
   - Bills enhancements (recurrence, income)
   - Misc Shopping (remove needs/wants, enhance queue)
   - Auto (projected maintenance, unified transactions)
   - Supplements (complex frequency, links, budget, purchases)
   - Grocery (favorite foods, enhanced purchases)
   - Unified Budgets system
3. **Create indexes for new columns**
4. **Update RLS policies for new tables**
5. **Test on staging**
6. **Deploy to production**

---

## Rollback Plan

If issues occur:
1. Restore from backup: `pg_restore --clean backup_file.dump`
2. Individual column rollbacks use: `ALTER TABLE ... DROP COLUMN IF EXISTS ...`
3. New tables can be dropped: `DROP TABLE IF EXISTS ...`

---

## Next Steps

1. Review this plan
2. Create consolidated SQL migration file
3. Test on staging environment
4. Update frontend components to use new schema
5. Deploy to production
