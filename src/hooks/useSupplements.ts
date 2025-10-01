import { useLiveQuery } from 'dexie-react-hooks';
import { db, Supplement, SupplementLog } from '../lib/db';
import { startOfDay, endOfDay } from 'date-fns';

export function useActiveSupplements() {
  return useLiveQuery(() =>
    db.supplements.filter(s => s.isActive === true).toArray()
  );
}

export function useSupplementLogs(supplementId: number, date: Date = new Date()) {
  return useLiveQuery(() => {
    const start = startOfDay(date);
    const end = endOfDay(date);

    return db.supplementLogs
      .where('supplementId')
      .equals(supplementId)
      .and(log => log.timestamp >= start && log.timestamp <= end)
      .toArray();
  }, [supplementId, date.toDateString()]);
}

export async function addSupplement(supplement: Omit<Supplement, 'id' | 'createdAt'>) {
  return await db.supplements.add({
    ...supplement,
    createdAt: new Date()
  });
}

export async function logSupplementIntake(log: Omit<SupplementLog, 'id'>) {
  return await db.supplementLogs.add(log);
}

export async function toggleSupplementActive(id: number) {
  const supplement = await db.supplements.get(id);
  if (supplement) {
    await db.supplements.update(id, { isActive: !supplement.isActive });
  }
}
