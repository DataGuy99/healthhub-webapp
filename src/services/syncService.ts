import { getUserId, getPasscode } from '../lib/auth';
import { getUnsynced, markAsSynced, clearSyncedItems } from '../lib/syncQueue';
import { db } from '../lib/db';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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

    const response = await fetch(`${API_BASE}/sync`, {
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

export async function downloadAllData(): Promise<{ success: boolean; error?: string }> {
  const userId = getUserId();
  const passcode = getPasscode();

  if (!userId || !passcode) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const response = await fetch(`${API_BASE}/data/all`, {
      method: 'GET',
      headers: {
        'X-User-ID': userId,
        'X-Passcode': passcode
      }
    });

    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }

    const data = await response.json();

    await db.transaction('rw', [db.supplements, db.supplementLogs, db.supplementSections], async () => {
      for (const supplement of data.supplements) {
        await db.supplements.put({
          id: supplement.id,
          name: supplement.name,
          dose: supplement.dose,
          doseUnit: supplement.dose_unit,
          form: supplement.form,
          section: supplement.section,
          activeDays: supplement.activeDays,
          isStack: supplement.isStack,
          stackId: supplement.stack_id,
          order: supplement.order,
          createdAt: new Date(supplement.createdAt)
        });
      }

      for (const log of data.supplementLogs) {
        await db.supplementLogs.put({
          id: log.id,
          supplementId: log.supplementId,
          date: log.date,
          isTaken: log.isTaken,
          timestamp: new Date(log.timestamp)
        });
      }

      for (const section of data.supplementSections) {
        await db.supplementSections.put({
          id: section.id,
          name: section.name,
          order: section.order,
          createdAt: new Date(section.createdAt)
        });
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Download error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function uploadAllData(): Promise<{ success: boolean; error?: string }> {
  const userId = getUserId();
  const passcode = getPasscode();

  if (!userId || !passcode) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const supplements = await db.supplements.toArray();
    const supplementLogs = await db.supplementLogs.toArray();
    const supplementSections = await db.supplementSections.toArray();

    const syncItems = [
      ...supplements.map(s => ({
        action: 'supplement' as const,
        operation: 'create' as const,
        data: s
      })),
      ...supplementLogs.map(l => ({
        action: 'supplement_log' as const,
        operation: 'create' as const,
        data: l
      })),
      ...supplementSections.map(s => ({
        action: 'section' as const,
        operation: 'create' as const,
        data: s
      }))
    ];

    if (syncItems.length === 0) {
      return { success: true };
    }

    const response = await fetch(`${API_BASE}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': userId,
        'X-Passcode': passcode
      },
      body: JSON.stringify({ items: syncItems })
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    return { success: true };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
