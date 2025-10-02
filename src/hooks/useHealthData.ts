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
  let totalCount = 0;

  for (const exportData of data) {
    const timestamp = new Date(exportData.time);
    const d = exportData.data;

    const metrics: any[] = [];

    // Add scalar metrics
    if (d.steps) metrics.push({ timestamp, metricType: 'steps', value: d.steps, unit: 'steps', source: 'health_connect' });
    if (d.sleep_duration_seconds) metrics.push({ timestamp, metricType: 'sleep_duration', value: d.sleep_duration_seconds / 3600, unit: 'hours', source: 'health_connect' });
    if (d.heart_rate_avg) metrics.push({ timestamp, metricType: 'heart_rate_avg', value: d.heart_rate_avg, unit: 'bpm', source: 'health_connect' });
    if (d.heart_rate_min) metrics.push({ timestamp, metricType: 'heart_rate_min', value: d.heart_rate_min, unit: 'bpm', source: 'health_connect' });
    if (d.heart_rate_max) metrics.push({ timestamp, metricType: 'heart_rate_max', value: d.heart_rate_max, unit: 'bpm', source: 'health_connect' });
    if (d.resting_heart_rate) metrics.push({ timestamp, metricType: 'resting_heart_rate', value: d.resting_heart_rate, unit: 'bpm', source: 'health_connect' });
    if (d.hrv_rmssd) metrics.push({ timestamp, metricType: 'hrv_rmssd', value: d.hrv_rmssd, unit: 'ms', source: 'health_connect' });
    if (d.oxygen_saturation) metrics.push({ timestamp, metricType: 'oxygen_saturation', value: d.oxygen_saturation, unit: '%', source: 'health_connect' });
    if (d.respiratory_rate) metrics.push({ timestamp, metricType: 'respiratory_rate', value: d.respiratory_rate, unit: 'bpm', source: 'health_connect' });
    if (d.weight_kg) metrics.push({ timestamp, metricType: 'weight', value: d.weight_kg, unit: 'kg', source: 'health_connect' });
    if (d.body_fat_percentage) metrics.push({ timestamp, metricType: 'body_fat', value: d.body_fat_percentage, unit: '%', source: 'health_connect' });
    if (d.active_calories) metrics.push({ timestamp, metricType: 'active_calories', value: d.active_calories, unit: 'kcal', source: 'health_connect' });
    if (d.total_calories) metrics.push({ timestamp, metricType: 'total_calories', value: d.total_calories, unit: 'kcal', source: 'health_connect' });

    // Add nutrition records
    if (d.nutrition_records) {
      for (const nr of d.nutrition_records) {
        metrics.push({
          timestamp: new Date(nr.time),
          metricType: 'nutrition',
          value: nr.calories,
          unit: 'kcal',
          source: 'health_connect',
          metadata: { name: nr.name, protein_g: nr.protein_g, carbs_g: nr.carbs_g, fat_g: nr.fat_g }
        });
      }
    }

    // Add exercise records
    if (d.exercise_records) {
      for (const er of d.exercise_records) {
        metrics.push({
          timestamp: new Date(er.time),
          metricType: 'exercise',
          value: er.duration_min,
          unit: 'minutes',
          source: 'health_connect',
          metadata: { type: er.type, title: er.title }
        });
      }
    }

    // Use bulkPut to handle duplicates (updates if exists, inserts if new)
    await db.healthMetrics.bulkPut(metrics);
    totalCount += metrics.length;
  }

  return totalCount;
}
