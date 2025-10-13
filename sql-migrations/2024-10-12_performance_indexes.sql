-- Performance Optimization: Missing Indexes
-- Date: 2024-10-12
-- Purpose: Add all missing composite and unique indexes for optimal query performance

-- ============================================================================
-- CRITICAL: Unique indexes for .single() queries
-- ============================================================================

-- grocery_budgets: Only one budget per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_grocery_budgets_user
  ON grocery_budgets(user_id);

-- protein_targets: Only one target per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_protein_targets_user
  ON protein_targets(user_id);

-- misc_shop_budgets: Only one budget per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_misc_shop_budgets_user
  ON misc_shop_budgets(user_id);

-- user_settings: Only one settings record per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_user
  ON user_settings(user_id);

-- supplement_logs: Unique per user, supplement, and date
CREATE UNIQUE INDEX IF NOT EXISTS idx_supplement_logs_unique
  ON supplement_logs(user_id, supplement_id, date);

-- ============================================================================
-- HIGH PRIORITY: Composite indexes for filtered + ordered queries
-- ============================================================================

-- gas_fillups: Filter by user, order by date and mileage
CREATE INDEX IF NOT EXISTS idx_gas_fillups_user_date_mileage
  ON gas_fillups(user_id, date DESC, mileage DESC);

-- maintenance_items: Filter by user and active status, order by service name
CREATE INDEX IF NOT EXISTS idx_maintenance_items_user_active
  ON maintenance_items(user_id, is_active, service_name);

-- recurring_bills: Filter by user and active status
CREATE INDEX IF NOT EXISTS idx_recurring_bills_user_active
  ON recurring_bills(user_id, is_active);

-- bill_payments: Date range queries by user
CREATE INDEX IF NOT EXISTS idx_bill_payments_user_date
  ON bill_payments(user_id, date);

-- grocery_purchases: Date range queries by user
CREATE INDEX IF NOT EXISTS idx_grocery_purchases_user_date
  ON grocery_purchases(user_id, date DESC);

-- protein_calculations: Recent calculations by user
CREATE INDEX IF NOT EXISTS idx_protein_calculations_user_created
  ON protein_calculations(user_id, created_at DESC);

-- misc_shop_purchases: Filter by user and month, order by date
CREATE INDEX IF NOT EXISTS idx_misc_shop_purchases_user_month_date
  ON misc_shop_purchases(user_id, month, date DESC);

-- supplements: Order by section and order for user
CREATE INDEX IF NOT EXISTS idx_supplements_user_section_order
  ON supplements(user_id, section, "order");

-- supplement_logs: Date-specific queries by user
CREATE INDEX IF NOT EXISTS idx_supplement_logs_user_date
  ON supplement_logs(user_id, date);

-- supplement_sections: Order sections for user
CREATE INDEX IF NOT EXISTS idx_supplement_sections_user_order
  ON supplement_sections(user_id, "order");

-- bank_accounts: Filter active accounts by user
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_active
  ON bank_accounts(user_id, is_active);

-- transactions: Recent transactions by user
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON transactions(user_id, date DESC);

-- category_logs: Date range queries by user
CREATE INDEX IF NOT EXISTS idx_category_logs_user_date
  ON category_logs(user_id, date);

-- category_logs: Efficient joins on foreign key
CREATE INDEX IF NOT EXISTS idx_category_logs_category_item
  ON category_logs(category_item_id);

-- category_budgets: Monthly budgets by user
CREATE INDEX IF NOT EXISTS idx_category_budgets_user_month
  ON category_budgets(user_id, month_year);

-- ============================================================================
-- VERIFY INDEX CREATION
-- ============================================================================

-- Run this query to verify all indexes were created successfully:
/*
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'gas_fillups', 'maintenance_items', 'recurring_bills', 'bill_payments',
    'grocery_budgets', 'grocery_purchases', 'protein_calculations', 'protein_targets',
    'misc_shop_budgets', 'misc_shop_purchases', 'supplements', 'supplement_logs',
    'supplement_sections', 'user_settings', 'bank_accounts', 'transactions',
    'category_logs', 'category_budgets'
  )
ORDER BY tablename, indexname;
*/
