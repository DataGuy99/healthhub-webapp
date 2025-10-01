import { db } from '../lib/db';

export interface HealthDataExport {
  time: number;
  data: {
    steps?: number;
    sleep_duration_seconds?: number;
    heart_rate_avg?: number;
    heart_rate_min?: number;
    heart_rate_max?: number;
    resting_heart_rate?: number;
    hrv_rmssd?: number;
    oxygen_saturation?: number;
    respiratory_rate?: number;
    weight_kg?: number;
    body_fat_percentage?: number;
    active_calories?: number;
    total_calories?: number;
    nutrition_records?: Array<{
      time: number;
      name: string;
      calories: number;
      protein_g: number;
      carbs_g: number;
      fat_g: number;
    }>;
    exercise_records?: Array<{
      time: number;
      type: number;
      duration_min: number;
      title: string;
    }>;
  };
}

export async function saveHealthDataExport(exportData: HealthDataExport) {
  const timestamp = new Date(exportData.time);
  const data = exportData.data;

  // Save all metrics to the health metrics table
  const metrics = [
    { type: 'steps', value: data.steps || 0, unit: 'steps' },
    { type: 'sleep_duration', value: (data.sleep_duration_seconds || 0) / 3600, unit: 'hours' },
    { type: 'heart_rate_avg', value: data.heart_rate_avg || 0, unit: 'bpm' },
    { type: 'heart_rate_min', value: data.heart_rate_min || 0, unit: 'bpm' },
    { type: 'heart_rate_max', value: data.heart_rate_max || 0, unit: 'bpm' },
    { type: 'resting_heart_rate', value: data.resting_heart_rate || 0, unit: 'bpm' },
    { type: 'hrv_rmssd', value: data.hrv_rmssd || 0, unit: 'ms' },
    { type: 'oxygen_saturation', value: data.oxygen_saturation || 0, unit: '%' },
    { type: 'respiratory_rate', value: data.respiratory_rate || 0, unit: 'bpm' },
    { type: 'weight', value: data.weight_kg || 0, unit: 'kg' },
    { type: 'body_fat', value: data.body_fat_percentage || 0, unit: '%' },
    { type: 'active_calories', value: data.active_calories || 0, unit: 'kcal' },
    { type: 'total_calories', value: data.total_calories || 0, unit: 'kcal' },
  ];

  // Save each metric
  for (const metric of metrics) {
    if (metric.value > 0) {
      await db.healthMetrics.add({
        timestamp,
        metricType: metric.type,
        value: metric.value,
        unit: metric.unit,
        source: 'health_connect',
        metadata: { export_time: exportData.time }
      });
    }
  }

  // Save nutrition records
  if (data.nutrition_records) {
    for (const record of data.nutrition_records) {
      await db.healthMetrics.add({
        timestamp: new Date(record.time),
        metricType: 'nutrition',
        value: record.calories,
        unit: 'kcal',
        source: 'health_connect',
        metadata: {
          name: record.name,
          protein_g: record.protein_g,
          carbs_g: record.carbs_g,
          fat_g: record.fat_g
        }
      });
    }
  }

  // Save exercise records
  if (data.exercise_records) {
    for (const record of data.exercise_records) {
      await db.healthMetrics.add({
        timestamp: new Date(record.time),
        metricType: 'exercise',
        value: record.duration_min,
        unit: 'minutes',
        source: 'health_connect',
        metadata: {
          type: record.type,
          title: record.title
        }
      });
    }
  }

  console.log('✅ Health data saved to IndexedDB');
}
