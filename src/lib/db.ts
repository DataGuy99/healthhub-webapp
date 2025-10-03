import { Supplement, SupplementLog, SupplementSection } from './supabase';

const DB_NAME = 'healthhub_offline';
const DB_VERSION = 1;

export interface SyncQueueItem {
  id?: number;
  type: 'supplement' | 'supplement_log' | 'supplement_section';
  operation: 'create' | 'update' | 'delete';
  data: any;
  localId?: string; // For items created offline
  serverId?: string; // Supabase ID
  timestamp: number;
  synced: boolean;
  error?: string;
}

class OfflineDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Supplements store
        if (!db.objectStoreNames.contains('supplements')) {
          const supplementsStore = db.createObjectStore('supplements', { keyPath: 'id' });
          supplementsStore.createIndex('user_id', 'user_id', { unique: false });
          supplementsStore.createIndex('section', 'section', { unique: false });
        }

        // Supplement logs store
        if (!db.objectStoreNames.contains('supplement_logs')) {
          const logsStore = db.createObjectStore('supplement_logs', { keyPath: 'id' });
          logsStore.createIndex('user_id', 'user_id', { unique: false });
          logsStore.createIndex('date', 'date', { unique: false });
          logsStore.createIndex('supplement_id', 'supplement_id', { unique: false });
        }

        // Supplement sections store
        if (!db.objectStoreNames.contains('supplement_sections')) {
          const sectionsStore = db.createObjectStore('supplement_sections', { keyPath: 'id' });
          sectionsStore.createIndex('user_id', 'user_id', { unique: false });
        }

        // Sync queue store
        if (!db.objectStoreNames.contains('sync_queue')) {
          const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('synced', 'synced', { unique: false });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Metadata store (last sync time, etc.)
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  // Generic CRUD operations
  async getAll<T>(storeName: string, indexName?: string, indexValue?: any): Promise<T[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);

      let request: IDBRequest;
      if (indexName && indexValue !== undefined) {
        const index = store.index(indexName);
        request = index.getAll(indexValue);
      } else {
        request = store.getAll();
      }

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get<T>(storeName: string, id: string): Promise<T | undefined> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async put(storeName: string, data: any): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(storeName: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Sync queue operations
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('sync_queue', 'readwrite');
      const store = transaction.objectStore('sync_queue');
      const request = store.add(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('sync_queue', 'readonly');
      const store = transaction.objectStore('sync_queue');
      const index = store.index('synced');
      const request = index.getAll(false);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async markSynced(id: number, serverId?: string, error?: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('sync_queue', 'readwrite');
      const store = transaction.objectStore('sync_queue');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          item.synced = !error;
          item.error = error;
          if (serverId) item.serverId = serverId;

          const putRequest = store.put(item);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async clearSyncedItems(): Promise<void> {
    if (!this.db) await this.init();

    // Get synced items directly (not pending items)
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('sync_queue', 'readwrite');
      const store = transaction.objectStore('sync_queue');
      const index = store.index('synced');
      const request = index.getAll(true); // Get synced items

      request.onsuccess = () => {
        const syncedItems = request.result;

        if (syncedItems.length === 0) {
          resolve();
          return;
        }

        let completed = 0;
        syncedItems.forEach(item => {
          const deleteRequest = store.delete(item.id!);
          deleteRequest.onsuccess = () => {
            completed++;
            if (completed === syncedItems.length) resolve();
          };
          deleteRequest.onerror = () => reject(deleteRequest.error);
        });
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Metadata operations
  async setMetadata(key: string, value: any): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('metadata', 'readwrite');
      const store = transaction.objectStore('metadata');
      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMetadata(key: string): Promise<any> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction('metadata', 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }
}

export const db = new OfflineDB();
