# SQL Migrations

This folder contains all Supabase SQL migration files in chronological order.

## How to Use

1. Open Supabase Dashboard → SQL Editor
2. Copy/paste the contents of each file
3. Run them in chronological order (by date in filename)

## Migration Files

### 2024-10-11 (Initial Database Setup)
- **2024-10-11_complete_database.sql** - Complete initial database schema
- **2024-10-11_category_tables.sql** - Category items and logs tables
- **2024-10-11_transaction_rules.sql** - Transaction categorization rules

### 2024-10-12 (Bills & Category Management)
- **2024-10-12_recurring_bills.sql** - Recurring bills definitions
- **2024-10-12_bill_payments.sql** - Bill payment tracking
- **2024-10-12_user_categories.sql** - User-created custom categories

## Table Descriptions

### recurring_bills
Stores recurring bill definitions (rent, utilities, subscriptions, etc.)
- Weekly or monthly frequency
- Custom icons and colors
- Special "skip first week" for rent payments
- Full RLS policies

### bill_payments
Tracks individual bill payment instances
- Links to recurring bills
- Paid/unpaid status with timestamps
- Unique constraint: one payment per bill per date
- Full RLS policies

### user_categories
User-created custom categories for dynamic tab management
- Custom icons, colors, and template types
- Display order control
- Sub-tabs configuration (JSON)
- Full RLS policies

## Notes

- All tables have Row Level Security (RLS) enabled
- Policies ensure users can only access their own data
- Foreign keys ensure referential integrity
- Indexes added for query performance
