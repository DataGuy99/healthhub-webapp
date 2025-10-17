# Supabase Database

## ⭐ PREFERRED METHOD: Consolidated Schema

**`healthhub_complete_schema.sql`** (929 lines) - **SINGLE SOURCE OF TRUTH**

All new tables are added to this file. Individual migration files are archived.

### What's Included:
- **38 Tables** with constraints, indexes, RLS policies, and triggers
- **Phase 1**: Health data tracking (4 tables)
- **Phase 2**: Correlations & insights (4 tables)
- **Phase 3**: Budget optimization & smart queue (3 tables + supplements enhancements)
- Helper functions: `reorder_purchase_queue()`, `calculate_supplement_roi()`
- Optimized RLS policies using `(select auth.uid())` pattern

### How to Apply:
1. Go to Supabase Dashboard → SQL Editor
2. Copy/paste contents of `healthhub_complete_schema.sql`
3. Run the query

**Uses `IF NOT EXISTS` for tables/columns, safe to run multiple times.**

---

## Active Migrations (Legacy)

These migrations are kept for incremental updates but **Phase 2 & 3 are now in consolidated schema**:

1. `20251011_create_finance_tables.sql` - Base finance system
2. `20251011000002_create_category_tables.sql` - Generic category system
3. `20251011000003_create_transaction_rules.sql` - Auto-categorization rules
4. `20251011000004_create_budget_and_bills_tables.sql` - Budgets & bills
5. `20251013000001_add_protein_goal_tracking.sql` - Protein tracking
6. `20251013000002_add_num_servings_to_protein_calculations.sql` - Servings calc
7. `20251015000001_add_auto_cost_analysis.sql` - Auto cost-per-mile analysis
8. `20251016000001_add_health_data_tracking.sql` - Health data points
9. `20251016000002_add_health_data_upload.sql` - Android upload system

## Archived Migrations

Moved to `migrations/archive/` (consolidated into main schema):
- `20251016000003_add_correlation_insights_tables.sql` - Phase 2 correlations
- `20251016000004_fix_supabase_linter_issues.sql` - RLS optimizations
- `20251016000005_add_budget_optimization.sql` - Phase 3 budget optimizer
- `20251016000006_add_phase2_phase3_tables.sql` - Combined Phase 2+3

---

## Adding New Tables (Process)

**When Phase 4, 5, etc. require new tables:**

1. Add to END of `healthhub_complete_schema.sql`
2. Use `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS`
3. Include indexes, triggers, RLS policies in same section
4. Archive any individual migration files to `migrations/archive/`
5. Update this README with new table count

**Goal**: ONE clean consolidated file instead of dozens of migrations.

---

## Database Structure

### Core Systems
- **Finance**: Transactions, budgets, bank accounts (Plaid integration)
- **Supplements**: Library, daily logging, sections, cost tracking (Phase 3: monthly_cost columns)
- **Categories**: Generic system for grocery, auto, misc shopping, bills
- **Health**: Data points from Android, correlations with supplements (Phase 2)
- **Budget Optimization**: ROI analysis, smart purchase queue, decision tracking (Phase 3)
- **Analytics**: Auto cost-per-mile, protein cost analysis, health ROI calculations
