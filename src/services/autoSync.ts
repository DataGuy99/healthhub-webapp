// Auto-sync is now handled via manual import from the Import tab
// The Android app sends data to Netlify webhook which logs it
// User manually imports the JSON data via the Import Data UI

export async function fetchAndSyncHealthData(): Promise<{ success: boolean; count: number; error?: string }> {
  // No automatic sync from server - data is imported manually via UI
  return { success: true, count: 0 };
}
