import { importHealthData } from '../hooks/useHealthData';
import { getUserId } from '../lib/auth';

const FIREBASE_URL = 'https://healthhub-data-default-rtdb.firebaseio.com';

export async function fetchAndSyncHealthData(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const userId = getUserId() || 'default';
    const response = await fetch(`${FIREBASE_URL}/users/${userId}/metrics.json`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const exports = await response.json();

    if (!exports || !Array.isArray(exports) || exports.length === 0) {
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
