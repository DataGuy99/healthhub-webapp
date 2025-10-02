import Dexie, { Table } from 'dexie';

export interface SyncQueueItem {
  id?: number;
  userId: string;
  action: 'supplement_log' | 'supplement' | 'section' | 'health_metric';
  operation: 'create' | 'update' | 'delete';
  data: any;
  timestamp: Date;
  synced: boolean;
}

export class SyncQueueDB extends Dexie {
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super('SyncQueueDB');
    this.version(1).stores({
      syncQueue: '++id, userId, timestamp, synced, [userId+synced]'
    });
  }
}

export const syncQueueDB = new SyncQueueDB();

export async function addToSyncQueue(
  userId: string,
  action: SyncQueueItem['action'],
  operation: SyncQueueItem['operation'],
  data: any
): Promise<void> {
  await syncQueueDB.syncQueue.add({
    userId,
    action,
    operation,
    data,
    timestamp: new Date(),
    synced: false
  });
}

export async function getUnsynced(userId: string): Promise<SyncQueueItem[]> {
  return await syncQueueDB.syncQueue
    .where('[userId+synced]')
    .equals([userId, 0])
    .sortBy('timestamp');
}

export async function markAsSynced(id: number): Promise<void> {
  await syncQueueDB.syncQueue.update(id, { synced: true });
}

export async function clearSyncedItems(userId: string): Promise<void> {
  await syncQueueDB.syncQueue
    .where('[userId+synced]')
    .equals([userId, 1])
    .delete();
}
