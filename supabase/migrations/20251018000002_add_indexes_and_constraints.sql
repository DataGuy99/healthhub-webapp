-- Add unique constraints and composite indexes for performance
-- Based on Phase 6 specifications for .single() usage and query optimization

-- ============================================================================
-- UNIQUE CONSTRAINTS (Required for .single() queries)
-- ============================================================================

-- Ensure single row per user for these tables
ALTER TABLE grocery_budgets DROP CONSTRAINT IF EXISTS unique_grocery_budgets_user;
ALTER TABLE grocery_budgets ADD CONSTRAINT unique_grocery_budgets_user UNIQUE (user_id);

ALTER TABLE protein_targets DROP CONSTRAINT IF EXISTS unique_protein_targets_user;
ALTER TABLE protein_targets ADD CONSTRAINT unique_protein_targets_user UNIQUE (user_id);

ALTER TABLE misc_shop_budgets DROP CONSTRAINT IF EXISTS unique_misc_shop_budgets_user;
ALTER TABLE misc_shop_budgets ADD CONSTRAINT unique_misc_shop_budgets_user UNIQUE (user_id);

ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS unique_user_settings_user;
ALTER TABLE user_settings ADD CONSTRAINT unique_user_settings_user UNIQUE (user_id);

-- ============================================================================
-- COMPOSITE INDEXES (Performance optimization for common queries)
-- ============================================================================

-- Gas fillups: user + date + mileage (for MPG calculations)
CREATE INDEX IF NOT EXISTS idx_gas_fillups_user_date_mileage ON gas_fillups(user_id, date, mileage);

-- Maintenance items: user + active status + service name (for active items lookup)
CREATE INDEX IF NOT EXISTS idx_maintenance_items_user_active_name ON maintenance_items(user_id, is_active, service_name);

-- Recurring bills: user + active status (for active bills lookup)
CREATE INDEX IF NOT EXISTS idx_recurring_bills_user_active ON recurring_bills(user_id, is_active);

-- Protein calculations: user + created_at (for recent calculations)
CREATE INDEX IF NOT EXISTS idx_protein_calculations_user_created ON protein_calculations(user_id, created_at);

-- Misc shop purchases: user + month + date (for monthly aggregation)
CREATE INDEX IF NOT EXISTS idx_misc_shop_purchases_user_month_date ON misc_shop_purchases(user_id, month, date);

-- Supplements: user + section + order (for section-based display)
CREATE INDEX IF NOT EXISTS idx_supplements_user_section_order ON supplements(user_id, section, "order");

-- Supplement logs: user + date (for daily logging lookup)
CREATE INDEX IF NOT EXISTS idx_supplement_logs_user_date ON supplement_logs(user_id, date);

-- Supplement sections: user + order (for ordered section display)
CREATE INDEX IF NOT EXISTS idx_supplement_sections_user_order ON supplement_sections(user_id, "order");

-- Bank accounts: user + active status (for active accounts lookup)
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_active ON bank_accounts(user_id, is_active);

-- Transactions: user + date (for date-range queries)
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);

-- Category budgets: user + month_year (for monthly budget lookup)
CREATE INDEX IF NOT EXISTS idx_category_budgets_user_month_year ON category_budgets(user_id, month_year);

-- Bill payments: user + date (for date-range queries)
CREATE INDEX IF NOT EXISTS idx_bill_payments_user_date ON bill_payments(user_id, date);

-- Grocery purchases: user + date (for date-range queries)
CREATE INDEX IF NOT EXISTS idx_grocery_purchases_user_date ON grocery_purchases(user_id, date);

-- Category logs: user + date (for daily/monthly aggregation)
CREATE INDEX IF NOT EXISTS idx_category_logs_user_date ON category_logs(user_id, date);

-- ============================================================================
-- ANALYSIS
-- ============================================================================
-- Run EXPLAIN ANALYZE on heavy queries after migration to confirm improvements
-- Example:
--   EXPLAIN ANALYZE SELECT * FROM gas_fillups WHERE user_id = 'xxx' ORDER BY date DESC LIMIT 10;
