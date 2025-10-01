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
      supplements: '++id, name, section, stackId, isStack',
      supplementLogs: '++id, supplementId, date, [supplementId+date]',
      supplementSections: '++id, name, order',
      correlations: '++id, metricA, metricB, calculatedAt'
    });
  }
}

export const db = new HealthHubDB();
