import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { subDays, startOfDay, endOfDay } from 'date-fns';

export function useHealthMetrics(metricType: string, days: number = 7) {
  return useLiveQuery(async () => {
    const startDate = startOfDay(subDays(new Date(), days));
    const endDate = endOfDay(new Date());

    return await db.healthMetrics
      .where('metricType')
      .equals(metricType)
      .and(m => m.timestamp >= startDate && m.timestamp <= endDate)
      .sortBy('timestamp');
  }, [metricType, days]);
}

export function useLatestMetrics() {
  return useLiveQuery(async () => {
    const metrics = await db.healthMetrics
      .orderBy('timestamp')
      .reverse()
      .limit(100)
      .toArray();

    // Group by metric type and get the latest of each
    const latest: Record<string, any> = {};
    for (const metric of metrics) {
      if (!latest[metric.metricType]) {
        latest[metric.metricType] = metric;
      }
    }
    return latest;
  });
}

export function useMetricStats(metricType: string, days: number = 30) {
  return useLiveQuery(async () => {
    const startDate = startOfDay(subDays(new Date(), days));
    const metrics = await db.healthMetrics
      .where('metricType')
      .equals(metricType)
      .and(m => m.timestamp >= startDate)
      .toArray();

    if (metrics.length === 0) return null;

    const values = metrics.map(m => m.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { avg, min, max, count: metrics.length };
  }, [metricType, days]);
}

export async function importHealthData(data: any[]) {
  // Transform Health Connect export to our format
  const metrics = data.map(item => ({
    timestamp: new Date(item.timestamp || item.time),
    metricType: item.type || item.metricType,
    value: parseFloat(item.value),
    unit: item.unit || '',
    source: item.source || 'Health Connect',
    metadata: item.metadata || {}
  }));

  await db.healthMetrics.bulkAdd(metrics);
  return metrics.length;
}
