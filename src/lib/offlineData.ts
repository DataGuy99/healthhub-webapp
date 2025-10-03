import { supabase, Supplement, SupplementLog, SupplementSection } from './supabase';
import { db } from './db';
import { syncManager } from './syncManager';

// Idempotency guard for init
let initPromise: Promise<void> | null = null;

// Offline-aware data operations
export const offlineData = {
  // Initialize offline database (idempotent)
  async init(userId: string): Promise<void> {
    if (initPromise) return initPromise;

    initPromise = (async () => {
      await db.init();
      if (syncManager.getOnlineStatus()) {
        await syncManager.initialSync(userId);
      }
    })();

    try {
      await initPromise;
    } finally {
      initPromise = null;
    }
  },

  // Supplements operations
  supplements: {
    async getAll(userId: string): Promise<Supplement[]> {
      // Always read from local DB (works offline and online)
      const supplements = await db.getAll<Supplement>('supplements', 'user_id', userId);
      return supplements;
    },

    async create(supplement: Supplement): Promise<Supplement> {
      const localId = syncManager.generateLocalId();
      const suppWithId = { ...supplement, id: localId };

      // Save to local DB immediately
      await db.put('supplements', suppWithId);

      // Queue for sync
      await syncManager.queueOperation('supplement', 'create', supplement);

      return suppWithId;
    },

    async update(id: string, updates: Partial<Supplement>): Promise<void> {
      // Get current data
      const current = await db.get<Supplement>('supplements', id);
      if (!current) throw new Error('Supplement not found');

      const updated = { ...current, ...updates };

      // Update local DB immediately
      await db.put('supplements', updated);

      // Queue for sync
      await syncManager.queueOperation('supplement', 'update', updated, id);
    },

    async delete(id: string): Promise<void> {
      // Delete from local DB immediately
      await db.delete('supplements', id);

      // Queue for sync
      await syncManager.queueOperation('supplement', 'delete', { id }, id);
    }
  },

  // Supplement logs operations
  logs: {
    async getByUserAndDate(userId: string, date: string): Promise<SupplementLog[]> {
      // Get all logs for user, then filter by date
      const allLogs = await db.getAll<SupplementLog>('supplement_logs', 'user_id', userId);
      return allLogs.filter(log => log.date === date);
    },

    async upsert(log: SupplementLog): Promise<SupplementLog> {
      const isUpdate = !!log.id;

      // Generate ID if needed
      const logWithId = {
        ...log,
        id: log.id || syncManager.generateLocalId(),
        timestamp: log.timestamp || new Date().toISOString()
      };

      // Save to local DB immediately
      await db.put('supplement_logs', logWithId);

      // Queue for sync (update if has ID, create if new)
      await syncManager.queueOperation(
        'supplement_log',
        isUpdate ? 'update' : 'create',
        logWithId,
        isUpdate ? logWithId.id : undefined
      );

      return logWithId;
    },

    async delete(id: string): Promise<void> {
      // Delete from local DB immediately
      await db.delete('supplement_logs', id);

      // Queue for sync
      await syncManager.queueOperation('supplement_log', 'delete', { id }, id);
    }
  },

  // Supplement sections operations
  sections: {
    async getAll(userId: string): Promise<SupplementSection[]> {
      const sections = await db.getAll<SupplementSection>('supplement_sections', 'user_id', userId);
      return sections.sort((a, b) => (a.order || 0) - (b.order || 0));
    },

    async create(section: SupplementSection): Promise<SupplementSection> {
      const localId = syncManager.generateLocalId();
      const sectionWithId = { ...section, id: localId };

      // Save to local DB immediately
      await db.put('supplement_sections', sectionWithId);

      // Queue for sync
      await syncManager.queueOperation('supplement_section', 'create', section);

      return sectionWithId;
    },

    async update(id: string, updates: Partial<SupplementSection>): Promise<void> {
      // Get current data
      const current = await db.get<SupplementSection>('supplement_sections', id);
      if (!current) throw new Error('Section not found');

      const updated = { ...current, ...updates };

      // Update local DB immediately
      await db.put('supplement_sections', updated);

      // Queue for sync
      await syncManager.queueOperation('supplement_section', 'update', updated, id);
    },

    async delete(id: string): Promise<void> {
      // Delete from local DB immediately
      await db.delete('supplement_sections', id);

      // Queue for sync
      await syncManager.queueOperation('supplement_section', 'delete', { id }, id);
    }
  },

  // Connection status
  onConnectionChange(callback: (online: boolean) => void): () => void {
    return syncManager.onConnectionChange(callback);
  },

  isOnline(): boolean {
    return syncManager.getOnlineStatus();
  }
};
