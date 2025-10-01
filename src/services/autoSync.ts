import { importHealthData } from '../hooks/useHealthData';

const GITHUB_DATA_URL = 'https://raw.githubusercontent.com/DataGuy99/healthhub-webapp/main/data/health-exports.json';

export async function fetchAndSyncHealthData(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const response = await fetch(GITHUB_DATA_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const exports = await response.json();

    if (!Array.isArray(exports) || exports.length === 0) {
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
