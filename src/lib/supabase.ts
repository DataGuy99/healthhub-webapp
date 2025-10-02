import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Supplement {
  id?: string;
  user_id?: string;
  name: string;
  dose?: string;
  dose_unit?: string;
  form?: string;
  section?: string;
  active_days?: number[];
  is_stack?: boolean;
  stack_id?: string;
  order?: number;
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
