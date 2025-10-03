import { supabase } from './supabase';
import { db, SyncQueueItem } from './db';

class SyncManager {
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;
  private listeners: Set<(online: boolean) => void> = new Set();
  private syncTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  private handleOnline() {
    console.log('🟢 Connection restored');
    this.isOnline = true;
    this.notifyListeners();
    this.syncAll();
  }

  private handleOffline() {
    console.log('🔴 Connection lost - switching to offline mode');
    this.isOnline = false;
    this.notifyListeners();
  }

  public onConnectionChange(callback: (online: boolean) => void) {
    this.listeners.add(callback);
    // Call immediately with current status
    callback(this.isOnline);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.isOnline));
  }

  public getOnlineStatus(): boolean {
    return this.isOnline;
  }

  // Generate a temporary local ID for offline-created items
  // Uses crypto.randomUUID() for guaranteed uniqueness
  public generateLocalId(): string {
    // Use crypto.randomUUID() if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `local_${crypto.randomUUID()}`;
    }
    // Fallback for older browsers
    return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Sync all pending operations
  async syncAll(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      console.log('Sync skipped:', this.syncInProgress ? 'already in progress' : 'offline');
      return;
    }

    this.syncInProgress = true;
    console.log('🔄 Starting sync...');

    try {
      const pendingItems = await db.getPendingSyncItems();
      console.log(`📋 ${pendingItems.length} items to sync`);

      // Sort by timestamp to maintain order
      pendingItems.sort((a, b) => a.timestamp - b.timestamp);

      for (const item of pendingItems) {
        try {
          await this.syncItem(item);
          // Mark as synced only on success (done in syncItem)
        } catch (error) {
          console.error('Failed to sync item:', item, error);
          // Don't mark as synced - leave for retry on next sync
          // Store error for debugging
          await db.markSynced(item.id!, undefined, (error as Error).message);
        }
      }

      // Clean up synced items
      await db.clearSyncedItems();
      console.log('✅ Sync complete');
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    const { type, operation, data, localId, serverId } = item;

    console.log(`Syncing ${operation} ${type}:`, data.name || data.id);

    if (type === 'supplement') {
      await this.syncSupplement(operation, data, localId, serverId, item.id!);
    } else if (type === 'supplement_log') {
      await this.syncSupplementLog(operation, data, localId, serverId, item.id!);
    } else if (type === 'supplement_section') {
      await this.syncSupplementSection(operation, data, localId, serverId, item.id!);
    }
  }

  private async syncSupplement(
    operation: string,
    data: any,
    localId: string | undefined,
    serverId: string | undefined,
    queueId: number
  ): Promise<void> {
    if (operation === 'create') {
      const { error, data: result } = await supabase
        .from('supplements')
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      // Update local DB with server ID
      if (localId && result) {
        await db.delete('supplements', localId);
        await db.put('supplements', result);
      }

      await db.markSynced(queueId, result.id);
    } else if (operation === 'update') {
      const { error } = await supabase
        .from('supplements')
        .update(data)
        .eq('id', serverId || data.id);

      if (error) throw error;

      // Update local DB
      await db.put('supplements', { ...data, id: serverId || data.id });
      await db.markSynced(queueId);
    } else if (operation === 'delete') {
      const { error } = await supabase
        .from('supplements')
        .delete()
        .eq('id', serverId || data.id);

      if (error) throw error;

      // Remove from local DB
      await db.delete('supplements', serverId || data.id);
      await db.markSynced(queueId);
    }
  }

  private async syncSupplementLog(
    operation: string,
    data: any,
    localId: string | undefined,
    serverId: string | undefined,
    queueId: number
  ): Promise<void> {
    if (operation === 'create' || operation === 'update') {
      // Use upsert for logs (handles both create and update)
      const { error, data: result } = await supabase
        .from('supplement_logs')
        .upsert(data, {
          onConflict: 'user_id,supplement_id,date'
        })
        .select()
        .single();

      if (error) throw error;

      // Update local DB
      if (localId && result) {
        await db.delete('supplement_logs', localId);
        await db.put('supplement_logs', result);
      } else if (result) {
        await db.put('supplement_logs', result);
      }

      await db.markSynced(queueId, result.id);
    } else if (operation === 'delete') {
      const { error } = await supabase
        .from('supplement_logs')
        .delete()
        .eq('id', serverId || data.id);

      if (error) throw error;

      await db.delete('supplement_logs', serverId || data.id);
      await db.markSynced(queueId);
    }
  }

  private async syncSupplementSection(
    operation: string,
    data: any,
    localId: string | undefined,
    serverId: string | undefined,
    queueId: number
  ): Promise<void> {
    if (operation === 'create') {
      const { error, data: result } = await supabase
        .from('supplement_sections')
        .insert(data)
        .select()
        .single();

      if (error) throw error;

      if (localId && result) {
        await db.delete('supplement_sections', localId);
        await db.put('supplement_sections', result);
      }

      await db.markSynced(queueId, result.id);
    } else if (operation === 'update') {
      const { error } = await supabase
        .from('supplement_sections')
        .update(data)
        .eq('id', serverId || data.id);

      if (error) throw error;

      await db.put('supplement_sections', { ...data, id: serverId || data.id });
      await db.markSynced(queueId);
    } else if (operation === 'delete') {
      const { error } = await supabase
        .from('supplement_sections')
        .delete()
        .eq('id', serverId || data.id);

      if (error) throw error;

      await db.delete('supplement_sections', serverId || data.id);
      await db.markSynced(queueId);
    }
  }

  // Initial data sync from Supabase to IndexedDB
  async initialSync(userId: string): Promise<void> {
    if (!this.isOnline) {
      console.log('Offline - skipping initial sync');
      return;
    }

    console.log('📥 Fetching data from Supabase...');

    try {
      // Fetch supplements
      const { data: supplements } = await supabase
        .from('supplements')
        .select('*')
        .eq('user_id', userId);

      if (supplements) {
        await db.clear('supplements');
        for (const supplement of supplements) {
          await db.put('supplements', supplement);
        }
        console.log(`✅ Synced ${supplements.length} supplements`);
      }

      // Fetch logs (last 30 days to limit data)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: logs } = await supabase
        .from('supplement_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

      if (logs) {
        await db.clear('supplement_logs');
        for (const log of logs) {
          await db.put('supplement_logs', log);
        }
        console.log(`✅ Synced ${logs.length} logs`);
      }

      // Fetch sections
      const { data: sections } = await supabase
        .from('supplement_sections')
        .select('*')
        .eq('user_id', userId);

      if (sections) {
        await db.clear('supplement_sections');
        for (const section of sections) {
          await db.put('supplement_sections', section);
        }
        console.log(`✅ Synced ${sections.length} sections`);
      }

      await db.setMetadata('lastSync', Date.now());
      console.log('✅ Initial sync complete');
    } catch (error) {
      console.error('Initial sync failed:', error);
      throw error;
    }
  }

  // Queue an operation for later sync
  async queueOperation(
    type: 'supplement' | 'supplement_log' | 'supplement_section',
    operation: 'create' | 'update' | 'delete',
    data: any,
    serverId?: string
  ): Promise<string> {
    const localId = data.id || this.generateLocalId();

    await db.addToSyncQueue({
      type,
      operation,
      data: { ...data, id: localId },
      localId: operation === 'create' ? localId : undefined,
      serverId: serverId || (operation !== 'create' ? data.id : undefined),
      timestamp: Date.now(),
      synced: false
    });

    // If online, debounce sync to batch rapid operations
    if (this.isOnline) {
      if (this.syncTimeout) {
        clearTimeout(this.syncTimeout);
      }
      this.syncTimeout = setTimeout(() => {
        this.syncAll().catch(console.error);
      }, 1000); // 1 second debounce
    }

    return localId;
  }
}

export const syncManager = new SyncManager();
