import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey && supabaseUrl !== '' && supabaseAnonKey !== '');

if (!isSupabaseConfigured) {
  console.error('❌ Supabase configuration missing! Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Ingredient {
  name: string;
  dose: string;
  dose_unit: string;
}

export type FrequencyPattern = 'everyday' | '5/2' | 'workout' | 'custom';

// Phase 6.2: Enhanced Supplement interface with complex frequency patterns and purchase tracking
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

  // Phase 6.2: Complex frequency patterns
  frequency_type?: 'daily' | 'weekly' | 'alternating' | 'cyclic' | 'custom';
  frequency_config?: {
    times_per_day?: number; // How many times per day
    days_of_week?: number[]; // [0,2,4] = Sun, Tue, Thu
    pattern?: 'on_off'; // Alternating days
    days_on?: number; // For cyclic pattern
    days_off?: number; // For cyclic pattern
    calendar?: Record<string, number[]>; // {"2025-10": [1,5,10,15]} = specific dates
  };

  // Phase 6.2: Product and purchase tracking
  product_url?: string; // Link to product page
  cost_per_container?: number;
  servings_per_container?: number;
  last_purchase_date?: string;
  is_in_stock?: boolean; // Toggle on/off based on stock
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

// Phase 6.2: Supplement purchase tracking
export interface SupplementPurchase {
  id?: string;
  user_id?: string;
  supplement_id?: string;
  purchase_date: string;
  cost: number;
  quantity?: number;
  notes?: string;
  created_at?: string;
}

// Phase 6.2: Supplement budget management
export interface SupplementBudget {
  id?: string;
  user_id?: string;
  budget_amount: number;
  month_year: string; // e.g., "2025-10"
  created_at?: string;
}

// ============================================================================
// Grocery Types
// ============================================================================

export interface FavoriteFood {
  id?: string;
  user_id?: string;
  food_name: string;
  serving_size: number;
  serving_unit: string;
  protein_grams: number;
  price: number;
  cost_per_gram: number;
  notes?: string;
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

// ============================================================================
// Category Hub Types
// ============================================================================

export interface CategoryItem {
  id?: string;
  user_id?: string;
  category: string;
  name: string;
  description?: string;
  amount?: number;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'one-time';
  subcategory?: string;
  tags?: string[];
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryLog {
  id?: string;
  user_id?: string;
  category_item_id: string;
  date: string;
  actual_amount?: number;
  notes?: string;
  timestamp?: string;
  is_planned?: boolean;
}

export interface CategoryBudget {
  id?: string;
  user_id?: string;
  category: string;
  month_year: string; // Format: 'YYYY-MM'
  target_amount: number;
  is_enabled?: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TransactionRule {
  id?: string;
  user_id?: string;
  keyword: string;
  category: string;
  template: 'market' | 'covenant' | 'chronicle' | 'treasury';
  created_at?: string;
  updated_at?: string;
}

export interface BudgetSettings {
  id?: string;
  user_id?: string;
  period_type: 'weekly' | 'biweekly' | 'monthly' | 'custom';
  period_start_day?: number; // 0-6 for weekly (0=Sunday), 1-31 for monthly
  period_start_date?: string; // For custom periods
  period_length_days?: number; // For custom periods
  created_at?: string;
  updated_at?: string;
}

export type CategoryTemplate = 'checklist' | 'spending' | 'events' | 'investments' | 'custom';

export interface UserCategory {
  id?: string;
  user_id?: string;
  name: string; // Display name (e.g., "Grocery", "Auto")
  slug: string; // URL-safe identifier (e.g., "grocery", "auto")
  icon: string; // Emoji icon
  color: string; // Tailwind gradient classes
  template: CategoryTemplate; // Which template to use
  order: number; // Display order
  is_active: boolean; // Show/hide
  sub_tabs?: SubTabConfig[]; // Optional sub-tabs
  created_at?: string;
  updated_at?: string;
}

export interface SubTabConfig {
  id: string; // Unique ID for this sub-tab
  name: string; // Display name
  icon: string; // Emoji icon
  template: CategoryTemplate; // Template type for this sub-tab
}

// ============================================================================
// Automotive Cost Analysis Types
// ============================================================================

export interface AutoCostAnalysis {
  id?: string;
  user_id?: string;
  analysis_period_start: string; // DATE format 'YYYY-MM-DD'
  analysis_period_end: string; // DATE format 'YYYY-MM-DD'
  total_miles_driven: number;
  total_maintenance_cost: number;
  total_fuel_cost: number;
  average_mpg: number;
  average_gas_price: number;
  cost_per_mile?: number; // Generated column, read-only
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// Health Data Tracking Types
// ============================================================================

export type HealthMetricType =
  | 'heart_rate'
  | 'blood_oxygen'
  | 'respiratory_rate'
  | 'body_temperature'
  | 'steps'
  | 'distance'
  | 'calories'
  | 'exercise'
  | 'sleep_stage'
  | 'nutrition'
  | 'hydration'
  | 'stress_level';

export interface HealthDataPoint {
  id?: string;
  user_id?: string;
  timestamp: string; // ISO 8601 timestamp
  type: HealthMetricType;
  value: number;
  accuracy?: number; // 0-100
  source: string; // 'smartwatch', 'phone', 'manual'
  context?: {
    activity?: string;
    location?: string;
    supplement_logs?: string[]; // Array of supplement IDs
    sleep_stage?: string;
    stress_level?: string;
  };
  metadata?: {
    device_id?: string;
    battery_level?: number;
    sensor_confidence?: number;
    environmental?: {
      temperature?: number;
      humidity?: number;
    };
  };
  created_at?: string;
}

export interface HealthSyncStatus {
  id?: string;
  user_id?: string;
  last_sync_timestamp?: string;
  data_points_count: number;
  sync_errors?: Array<{
    timestamp: string;
    error_message: string;
    error_code?: string;
  }>;
  created_at?: string;
  updated_at?: string;
}

export interface HealthDataUpload {
  id?: string;
  user_id?: string;
  encrypted_data: number[]; // Integer array from Android byte array
  iv: number[]; // Initialization vector for decryption
  data_point_count: number;
  extraction_timestamp: string;
  processed?: boolean;
  created_at?: string;
}
