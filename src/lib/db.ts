import Dexie, { Table } from 'dexie';

export interface HealthMetric {
  id?: number;
  timestamp: Date;
  metricType: string;
  value: number;
  unit: string;
  source: string;
  metadata?: Record<string, any>;
}

export interface Supplement {
  id?: number;
  name: string;
  dose: number;
  doseUnit: 'mL' | 'mcg' | 'mg' | 'g';
  form: 'Tincture' | 'Capsule' | 'Powder';
  section: string; // time of day section name
  activeDays: number[]; // 0-6 for Sun-Sat
  isStack: boolean; // if true, this is a prebuilt stack
  stackId?: string; // groups supplements into stacks
  order: number;
  createdAt: Date;
}

export interface SupplementLog {
  id?: number;
  supplementId: number;
  date: string; // YYYY-MM-DD
  isTaken: boolean;
  timestamp?: Date;
}

export interface SupplementSection {
  id?: number;
  name: string;
  order: number;
  createdAt: Date;
}

export interface Correlation {
  id?: number;
  metricA: string;
  metricB: string;
  coefficient: number;
  pValue: number;
  sampleSize: number;
  calculatedAt: Date;
}

export class HealthHubDB extends Dexie {
  healthMetrics!: Table<HealthMetric>;
  supplements!: Table<Supplement>;
  supplementLogs!: Table<SupplementLog>;
  supplementSections!: Table<SupplementSection>;
  correlations!: Table<Correlation>;

  constructor() {
    super('HealthHubDB');

    this.version(1).stores({
      healthMetrics: '++id, timestamp, metricType, [metricType+timestamp]',
      supplements: '++id, name, isActive',
      supplementLogs: '++id, supplementId, timestamp',
      correlations: '++id, metricA, metricB, calculatedAt'
    });

    // Version 2: Update supplement schema
    this.version(2).stores({
      healthMetrics: '++id, timestamp, metricType, [metricType+timestamp]',
      supplements: '++id, name, section, stackId, isStack, order',
      supplementLogs: '++id, supplementId, date, [supplementId+date]',
      supplementSections: '++id, name, order',
      correlations: '++id, metricA, metricB, calculatedAt'
    }).upgrade(async tx => {
      // Migrate supplements
      const oldSupplements = await tx.table('supplements').toArray();
      await tx.table('supplements').clear();
      await tx.table('supplements').bulkAdd(
        oldSupplements.map((s: any, index: number) => ({
          name: s.name,
          dose: s.dosage || s.dose || 1,
          doseUnit: s.dosageUnit || s.doseUnit || 'mg',
          form: s.form || (s.category === 'tincture' ? 'Tincture' : 'Capsule'),
          section: s.section || s.timing || 'Unsorted',
          activeDays: s.activeDays || (s.isActive ? [0,1,2,3,4,5,6] : []),
          isStack: s.isStack || false,
          stackId: s.stackId,
          order: s.order !== undefined ? s.order : index,
          createdAt: s.createdAt || new Date()
        }))
      );

      // Migrate supplement logs
      const oldLogs = await tx.table('supplementLogs').toArray();
      await tx.table('supplementLogs').clear();
      await tx.table('supplementLogs').bulkAdd(
        oldLogs.map((log: any) => ({
          supplementId: log.supplementId,
          date: log.date || (log.timestamp?.toISOString().split('T')[0]) || new Date().toISOString().split('T')[0],
          isTaken: log.isTaken !== undefined ? log.isTaken : true,
          timestamp: log.timestamp
        }))
      );

      // Initialize default sections
      const hasUnsorted = await tx.table('supplementSections').where('name').equals('Unsorted').count();
      if (hasUnsorted === 0) {
        await tx.table('supplementSections').add({
          name: 'Unsorted',
          order: 0,
          createdAt: new Date()
        });
      }
    });
  }
}

export const db = new HealthHubDB();
