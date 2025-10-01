import { importHealthData } from '../hooks/useHealthData';

const NETLIFY_HEALTH_DATA_URL = import.meta.env.VITE_HEALTH_DATA_URL || 'https://legendary-chaja-e17d86.netlify.app/.netlify/functions/health-data';

export async function fetchAndSyncHealthData(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const response = await fetch(NETLIFY_HEALTH_DATA_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    const exports = result.data || [];

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
