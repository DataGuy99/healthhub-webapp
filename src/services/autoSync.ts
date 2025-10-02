import { importHealthData } from '../hooks/useHealthData';
import { getUserId } from '../lib/auth';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export async function fetchAndSyncHealthData(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const userId = getUserId() || 'default';

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data: exports, error } = await supabase
      .from('health_exports')
      .select('*')
      .eq('user_id', userId)
      .order('export_time', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!exports || exports.length === 0) {
      return { success: true, count: 0 };
    }

    // Transform Supabase data to match expected format
    const transformedExports = exports.map(exp => ({
      time: exp.export_time,
      data: exp.data
    }));

    const metricsCount = await importHealthData(transformedExports);

    return { success: true, count: metricsCount };
  } catch (error) {
    console.error('Auto-sync failed:', error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
