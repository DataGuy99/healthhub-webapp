import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Ingredient {
  name: string;
  dose: string;
  dose_unit: string;
}

export type FrequencyPattern = 'everyday' | '5/2' | 'workout' | 'custom';

export interface Supplement {
  id?: string;
  user_id?: string;
  name: string;
  dose?: string;
  dose_unit?: string;
  ingredients?: Ingredient[];
  form?: string;
  section?: string;
  active_days?: number[]; // 0=Sunday, 1=Monday, ..., 6=Saturday
  frequency_pattern?: FrequencyPattern;
  is_stack?: boolean;
  stack_id?: string;
  order?: number;
  cost?: number;
  quantity?: number;
  frequency?: number; // times per day
  notes?: string;
  created_at?: string;
}

export interface SupplementLog {
  id?: string;
  user_id?: string;
  supplement_id: string;
  date: string;
  is_taken: boolean;
  timestamp?: string;
}

export interface SupplementSection {
  id?: string;
  user_id?: string;
  name: string;
  order?: number;
  created_at?: string;
}

// ============================================================================
// User Settings Types
// ============================================================================

export interface UserSettings {
  id?: string;
  user_id?: string;
  supplement_auto_log_time: string; // HH:MM:SS format
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// Finance Module Types
// ============================================================================

export interface BankAccount {
  id?: string;
  user_id?: string;
  plaid_access_token: string;
  plaid_item_id: string;
  institution_name: string;
  institution_id?: string;
  account_name?: string;
  account_mask?: string;
  account_type?: string;
  account_subtype?: string;
  is_active?: boolean;
  last_synced_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BudgetCategory {
  id?: string;
  user_id?: string;
  name: string;
  icon?: string;
  color?: string;
  parent_category_id?: string;
  is_system?: boolean;
  order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Transaction {
  id?: string;
  user_id?: string;
  bank_account_id?: string;
  plaid_transaction_id?: string;
  amount: number;
  date: string;
  timestamp?: string;
  merchant?: string;
  description?: string;
  category_id?: string;
  auto_categorized?: boolean;
  is_recurring?: boolean;
  recurring_series_id?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TransactionItem {
  id?: string;
  transaction_id: string;
  user_id?: string;
  name: string;
  pretax_amount: number;
  quantity?: number;
  unit_price?: number;
  category_id?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BudgetGoal {
  id?: string;
  user_id?: string;
  category_id?: string;
  name: string;
  target_amount: number;
  period: 'weekly' | 'monthly' | 'yearly';
  start_date: string;
  end_date?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PlaidSyncCursor {
  id?: string;
  user_id?: string;
  bank_account_id: string;
  cursor: string;
  last_synced_at?: string;
}
