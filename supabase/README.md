# Supabase Database

## Complete Schema
**`healthhub_complete_schema.sql`** - Full database schema with all tables, indexes, RLS policies, and triggers.

⚠️ **WARNING**: Running this file will DROP and recreate the entire database. Backup before use.

## Migrations

### Active Migrations (`/migrations/`)
Sequential migration files applied to the database:

1. `20251011_create_finance_tables.sql` - Base finance system
2. `20251011000002_create_category_tables.sql` - Generic category system
3. `20251011000003_create_transaction_rules.sql` - Auto-categorization rules
4. `20251011000004_create_budget_and_bills_tables.sql` - Budgets & bills
5. `20251013000001_add_protein_goal_tracking.sql` - Protein tracking
6. `20251013000002_add_num_servings_to_protein_calculations.sql` - Servings calc
7. `20251015000001_add_auto_cost_analysis.sql` - Auto cost-per-mile analysis
8. `20251016000001_add_health_data_tracking.sql` - Health data points
9. `20251016000002_add_health_data_upload.sql` - Android upload system
10. `20251016000003_add_correlation_insights_tables.sql` - **Phase 2 correlations**

### Archive (`/migrations/archive/`)
Old/duplicate migrations kept for reference.

## Applying Migrations

### Option 1: Individual Migrations (Recommended)
```bash
npx supabase db push
```

### Option 2: Full Schema Reset
Go to Supabase Dashboard → SQL Editor → Paste `healthhub_complete_schema.sql` → Run

## Database Structure

### Core Systems
- **Finance**: Transactions, budgets, bank accounts (Plaid integration)
- **Supplements**: Library, daily logging, sections, cost tracking
- **Categories**: Generic system for grocery, auto, misc shopping, bills
- **Health**: Data points from Android, correlations with supplements
- **Analytics**: Auto cost-per-mile, protein cost analysis, ROI analysis
