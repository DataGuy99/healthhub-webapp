import { db } from './db';

/**
 * Calculate Pearson correlation coefficient
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n !== y.length || n === 0) return 0;

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Simple p-value estimation (for display purposes)
 */
function estimatePValue(r: number, n: number): number {
  const absR = Math.abs(r);
  if (absR >= 0.7 && n >= 20) return 0.001;
  if (absR >= 0.5 && n >= 20) return 0.01;
  if (absR >= 0.3 && n >= 30) return 0.05;
  if (absR >= 0.2 && n >= 50) return 0.1;
  return 0.5;
}

/**
 * Calculate correlations between all metric pairs
 */
export async function calculateAllCorrelations(daysBack: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  // Get all metrics from the last N days
  const allMetrics = await db.healthMetrics
    .where('timestamp')
    .above(startDate)
    .toArray();

  // Group by metric type
  const metricsByType: Record<string, { timestamp: Date; value: number }[]> = {};

  for (const metric of allMetrics) {
    if (!metricsByType[metric.metricType]) {
      metricsByType[metric.metricType] = [];
    }
    metricsByType[metric.metricType].push({
      timestamp: metric.timestamp,
      value: metric.value
    });
  }

  const metricTypes = Object.keys(metricsByType);
  const correlations = [];

  // Calculate correlations between all pairs
  for (let i = 0; i < metricTypes.length; i++) {
    for (let j = i + 1; j < metricTypes.length; j++) {
      const typeA = metricTypes[i];
      const typeB = metricTypes[j];

      const dataA = metricsByType[typeA];
      const dataB = metricsByType[typeB];

      // Align data by day (simple daily average)
      const alignedData = alignMetricsByDay(dataA, dataB);

      if (alignedData.length < 10) continue; // Need minimum sample size

      const valuesA = alignedData.map(d => d.valueA);
      const valuesB = alignedData.map(d => d.valueB);

      const coefficient = pearsonCorrelation(valuesA, valuesB);
      const pValue = estimatePValue(coefficient, alignedData.length);

      correlations.push({
        metricA: typeA,
        metricB: typeB,
        coefficient,
        pValue,
        sampleSize: alignedData.length,
        calculatedAt: new Date()
      });
    }
  }

  // Save to database
  await db.correlations.clear();
  await db.correlations.bulkAdd(correlations);

  return correlations;
}

/**
 * Align two metric series by day (averaging values per day)
 */
function alignMetricsByDay(
  dataA: { timestamp: Date; value: number }[],
  dataB: { timestamp: Date; value: number }[]
): { date: string; valueA: number; valueB: number }[] {

  const dayMapA: Record<string, number[]> = {};
  const dayMapB: Record<string, number[]> = {};

  // Group by day
  for (const point of dataA) {
    const day = point.timestamp.toISOString().split('T')[0];
    if (!dayMapA[day]) dayMapA[day] = [];
    dayMapA[day].push(point.value);
  }

  for (const point of dataB) {
    const day = point.timestamp.toISOString().split('T')[0];
    if (!dayMapB[day]) dayMapB[day] = [];
    dayMapB[day].push(point.value);
  }

  // Calculate daily averages for days that have both metrics
  const aligned = [];
  for (const day in dayMapA) {
    if (dayMapB[day]) {
      const avgA = dayMapA[day].reduce((a, b) => a + b, 0) / dayMapA[day].length;
      const avgB = dayMapB[day].reduce((a, b) => a + b, 0) / dayMapB[day].length;
      aligned.push({ date: day, valueA: avgA, valueB: avgB });
    }
  }

  return aligned;
}

export function getCorrelationStrength(coefficient: number): string {
  const abs = Math.abs(coefficient);
  if (abs >= 0.8) return 'Very Strong';
  if (abs >= 0.6) return 'Strong';
  if (abs >= 0.4) return 'Moderate';
  if (abs >= 0.2) return 'Weak';
  return 'Very Weak';
}
