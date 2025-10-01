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
  category: string;
  dosage: number;
  dosageUnit: string;
  timing: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface SupplementLog {
  id?: number;
  supplementId: number;
  timestamp: Date;
  dosage: number;
  dosageUnit: string;
  notes?: string;
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
  correlations!: Table<Correlation>;

  constructor() {
    super('HealthHubDB');

    this.version(1).stores({
      healthMetrics: '++id, timestamp, metricType, [metricType+timestamp]',
      supplements: '++id, name, isActive',
      supplementLogs: '++id, supplementId, timestamp',
      correlations: '++id, metricA, metricB, calculatedAt'
    });
  }
}

export const db = new HealthHubDB();
