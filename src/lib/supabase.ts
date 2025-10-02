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

export interface Supplement {
  id?: string;
  user_id?: string;
  name: string;
  dose?: string;
  dose_unit?: string;
  ingredients?: Ingredient[];
  form?: string;
  section?: string;
  active_days?: number[];
  is_stack?: boolean;
  stack_id?: string;
  order?: number;
  cost?: number;
  quantity?: number;
  frequency?: number;
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
