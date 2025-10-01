import { importHealthData } from '../hooks/useHealthData';

const NETLIFY_HEALTH_DATA_URL = import.meta.env.VITE_HEALTH_DATA_URL || 'https://legendary-chaja-e17d86.netlify.app/.netlify/functions/health-data';

export async function fetchAndSyncHealthData(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const response = await fetch(NETLIFY_HEALTH_DATA_URL);

    // Even if response is not ok, try to parse it for empty data
    const result = await response.json();
    const exports = result.data || [];

    if (!response.ok) {
      // Return success with empty data if server returns empty array
      if (exports.length === 0) {
        return { success: true, count: 0 };
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (exports.length === 0) {
      return { success: true, count: 0 };
    }

    const metricsCount = await importHealthData(exports);

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
