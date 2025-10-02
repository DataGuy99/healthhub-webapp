import { getUserId, getPasscode } from '../lib/auth';
import { getUnsynced, markAsSynced, clearSyncedItems } from '../lib/syncQueue';

const SYNC_ENDPOINT = import.meta.env.VITE_SYNC_ENDPOINT || 'https://api.healthhub.example.com/sync';

export async function syncPendingChanges(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
  const userId = getUserId();
  const passcode = getPasscode();

  if (!userId || !passcode) {
    return { success: false, syncedCount: 0, error: 'Not authenticated' };
  }

  if (!navigator.onLine) {
    return { success: false, syncedCount: 0, error: 'Offline' };
  }

  try {
    const unsyncedItems = await getUnsynced(userId);

    if (unsyncedItems.length === 0) {
      return { success: true, syncedCount: 0 };
    }

    const response = await fetch(SYNC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
        'X-Passcode': passcode
      },
      body: JSON.stringify({
        items: unsyncedItems
      })
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`);
    }

    await Promise.all(unsyncedItems.map(item => markAsSynced(item.id!)));

    await clearSyncedItems(userId);

    return { success: true, syncedCount: unsyncedItems.length };
  } catch (error) {
    console.error('Sync error:', error);
    return {
      success: false,
      syncedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

let syncInterval: number | null = null;

export function startBackgroundSync(intervalMs: number = 60000) {
  if (syncInterval) {
    stopBackgroundSync();
  }

  syncInterval = window.setInterval(async () => {
    if (navigator.onLine) {
      await syncPendingChanges();
    }
  }, intervalMs);

  window.addEventListener('online', syncPendingChanges);
}

export function stopBackgroundSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  window.removeEventListener('online', syncPendingChanges);
}
