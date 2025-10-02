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
 * Calculate p-value for Pearson correlation using t-distribution approximation
 */
function estimatePValue(r: number, n: number): number {
  if (n < 3) return 1.0; // Not enough data
  if (Math.abs(r) >= 0.9999) return 0.0001; // Near-perfect correlation

  // Calculate t-statistic: t = r * sqrt(n-2) / sqrt(1-r²)
  const df = n - 2;
  const t = r * Math.sqrt(df) / Math.sqrt(1 - r * r);
  const absT = Math.abs(t);

  // Approximate two-tailed p-value using common t-distribution critical values
  // This is a rough approximation; for production use a proper stats library
  if (absT > 3.5) return Math.min(0.001, 1 / (df + 10));
  if (absT > 2.8) return Math.min(0.01, 5 / (df + 10));
  if (absT > 2.0) return Math.min(0.05, 20 / (df + 10));
  if (absT > 1.3) return Math.min(0.2, 50 / (df + 10));

  return Math.min(1.0, 100 / (df + 10));
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

  // Group by day (local time)
  for (const point of dataA) {
    const date = new Date(point.timestamp);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (!dayMapA[day]) dayMapA[day] = [];
    dayMapA[day].push(point.value);
  }

  for (const point of dataB) {
    const date = new Date(point.timestamp);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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
