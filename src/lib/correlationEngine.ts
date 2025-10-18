// Phase 2: Correlation Engine - Statistical Analysis Between Supplements and Health Metrics
import { supabase } from './supabase';
import type { HealthDataPoint, HealthMetricType } from './supabase';

export interface SupplementLog {
  id: string;
  supplement_id: string;
  supplement_name: string;
  taken_at: string;
  amount: number;
  unit: string;
}

export interface CorrelationResult {
  supplement_id: string;
  supplement_name: string;
  health_metric: HealthMetricType;
  correlation_coefficient: number;
  p_value: number;
  effect_size: number;
  sample_size: number;
  baseline_average: number;
  post_supplement_average: number;
  improvement_percentage: number;
  confidence_level: number;
  is_significant: boolean;
}

export interface HealthImpactScore {
  metric: string;
  baseline_average: number;
  post_supplement_average: number;
  improvement_percentage: number;
  statistical_significance: number;
  confidence_level: number;
  effect_size: number;
}

/**
 * Calculate Pearson correlation coefficient between two arrays
 */
function calculatePearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
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
 * Calculate Cohen's d effect size
 */
function calculateCohenD(mean1: number, mean2: number, std1: number, std2: number, n1: number, n2: number): number {
  const pooledStd = Math.sqrt(((n1 - 1) * std1 * std1 + (n2 - 1) * std2 * std2) / (n1 + n2 - 2));
  return pooledStd === 0 ? 0 : (mean2 - mean1) / pooledStd;
}

/**
 * Calculate standard deviation
 */
function calculateStd(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculate t-statistic and p-value for correlation
 */
function calculatePValue(r: number, n: number): number {
  if (n <= 2) return 1.0;
  const t = r * Math.sqrt(n - 2) / Math.sqrt(1 - r * r);
  // Simplified p-value approximation (for full implementation, use a t-distribution library)
  const df = n - 2;
  const pValue = 2 * (1 - normalCDF(Math.abs(t)));
  return Math.max(0, Math.min(1, pValue));
}

/**
 * Simplified normal CDF approximation
 */
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/**
 * Analyze correlation between a supplement and a health metric
 */
export async function analyzeSupplementHealthCorrelation(
  userId: string,
  supplementId: string,
  healthMetric: HealthMetricType,
  timeWindowDays: number = 30
): Promise<CorrelationResult | null> {
  try {
    // Calculate time range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeWindowDays);

    // Fetch supplement logs
    const { data: supplementLogs, error: supplementError } = await supabase
      .from('supplement_logs')
      .select('*, supplements(name)')
      .eq('user_id', userId)
      .eq('supplement_id', supplementId)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .eq('is_taken', true)
      .order('timestamp', { ascending: true });

    if (supplementError) throw supplementError;
    if (!supplementLogs || supplementLogs.length < 5) {
      console.log('Insufficient supplement logs for correlation');
      return null;
    }

    // Fetch health data for the same period
    const { data: healthData, error: healthError } = await supabase
      .from('health_data_points')
      .select('*')
      .eq('user_id', userId)
      .eq('type', healthMetric)
      .gte('timestamp', startDate.toISOString())
      .lte('timestamp', endDate.toISOString())
      .order('timestamp', { ascending: true });

    if (healthError) throw healthError;
    if (!healthData || healthData.length < 5) {
      console.log('Insufficient health data for correlation');
      return null;
    }

    // Calculate baseline (before any supplements in window)
    const firstSupplementTime = new Date(supplementLogs[0].taken_at).getTime();
    const baselineData = healthData.filter(point => new Date(point.timestamp).getTime() < firstSupplementTime);

    // Calculate post-supplement averages (after first supplement, within 24 hours of any supplement)
    const postSupplementData: number[] = [];

    supplementLogs.forEach(log => {
      const supplementTime = new Date(log.taken_at).getTime();
      const windowStart = supplementTime;
      const windowEnd = supplementTime + (24 * 60 * 60 * 1000); // 24 hours after supplement

      const relevantHealthData = healthData.filter(point => {
        const pointTime = new Date(point.timestamp).getTime();
        return pointTime >= windowStart && pointTime <= windowEnd;
      });

      if (relevantHealthData.length > 0) {
        const avgValue = relevantHealthData.reduce((sum, p) => sum + p.value, 0) / relevantHealthData.length;
        postSupplementData.push(avgValue);
      }
    });

    if (baselineData.length < 3 || postSupplementData.length < 3) {
      console.log('Insufficient data for baseline vs post-supplement comparison');
      return null;
    }

    // Calculate statistics
    const baselineValues = baselineData.map(p => p.value);
    const baselineAvg = baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length;
    const postSupplementAvg = postSupplementData.reduce((a, b) => a + b, 0) / postSupplementData.length;

    const improvementPercentage = baselineAvg !== 0
      ? ((postSupplementAvg - baselineAvg) / baselineAvg) * 100
      : 0;

    // Calculate correlation coefficient
    // Create paired data: for each supplement log, find average health metric in following 24h
    const pairedX: number[] = []; // Supplement taken (1) or not (0)
    const pairedY: number[] = []; // Health metric value

    // Group health data by day
    const healthDataByDay = new Map<string, number[]>();
    healthData.forEach(point => {
      const dayKey = new Date(point.timestamp).toISOString().split('T')[0];
      if (!healthDataByDay.has(dayKey)) {
        healthDataByDay.set(dayKey, []);
      }
      healthDataByDay.get(dayKey)!.push(point.value);
    });

    // Create supplement taken map by day
    const supplementByDay = new Set<string>();
    supplementLogs.forEach(log => {
      const dayKey = new Date(log.timestamp).toISOString().split('T')[0];
      supplementByDay.add(dayKey);
    });

    // Build paired arrays
    healthDataByDay.forEach((values, dayKey) => {
      const avgHealthValue = values.reduce((a, b) => a + b, 0) / values.length;
      const supplementTaken = supplementByDay.has(dayKey) ? 1 : 0;

      pairedX.push(supplementTaken);
      pairedY.push(avgHealthValue);
    });

    if (pairedX.length < 5) {
      console.log('Insufficient paired data points for correlation');
      return null;
    }

    const correlationCoefficient = calculatePearsonCorrelation(pairedX, pairedY);
    const pValue = calculatePValue(correlationCoefficient, pairedX.length);

    // Calculate effect size (Cohen's d)
    const baselineStd = calculateStd(baselineValues);
    const postSupplementStd = calculateStd(postSupplementData);
    const effectSize = calculateCohenD(
      baselineAvg,
      postSupplementAvg,
      baselineStd,
      postSupplementStd,
      baselineValues.length,
      postSupplementData.length
    );

    // Calculate confidence level based on p-value and sample size
    const confidenceLevel = (1 - pValue) * 100 * Math.min(pairedX.length / 30, 1);

    const result: CorrelationResult = {
      supplement_id: supplementId,
      supplement_name: (supplementLogs[0] as any).supplements?.name || 'Unknown',
      health_metric: healthMetric,
      correlation_coefficient: correlationCoefficient,
      p_value: pValue,
      effect_size: effectSize,
      sample_size: pairedX.length,
      baseline_average: baselineAvg,
      post_supplement_average: postSupplementAvg,
      improvement_percentage: improvementPercentage,
      confidence_level: confidenceLevel,
      is_significant: pValue < 0.05 && Math.abs(correlationCoefficient) > 0.3
    };

    return result;
  } catch (error) {
    console.error('Error analyzing supplement-health correlation:', error);
    return null;
  }
}

/**
 * Analyze all supplements for correlations with all health metrics
 */
export async function analyzeAllCorrelations(
  userId: string,
  timeWindowDays: number = 30
): Promise<CorrelationResult[]> {
  try {
    // Get all supplements user has logged
    const { data: supplements, error: supplementError } = await supabase
      .from('supplements')
      .select('id, name')
      .eq('user_id', userId);

    if (supplementError) throw supplementError;
    if (!supplements || supplements.length === 0) {
      return [];
    }

    // Get available health metrics
    const healthMetrics: HealthMetricType[] = [
      'heart_rate',
      'blood_oxygen',
      'steps',
      'sleep_stage',
      'calories',
      'stress_level'
    ];

    const results: CorrelationResult[] = [];

    // Analyze each supplement against each metric
    for (const supplement of supplements) {
      for (const metric of healthMetrics) {
        const correlation = await analyzeSupplementHealthCorrelation(
          userId,
          supplement.id,
          metric,
          timeWindowDays
        );

        if (correlation && correlation.is_significant) {
          results.push(correlation);
        }
      }
    }

    return results;
  } catch (error) {
    console.error('Error analyzing all correlations:', error);
    return [];
  }
}

/**
 * Save correlation results to database
 */
export async function saveCorrelationResults(
  userId: string,
  correlations: CorrelationResult[]
): Promise<boolean> {
  try {
    const records = correlations.map(corr => ({
      user_id: userId,
      supplement_id: corr.supplement_id,
      health_metric: corr.health_metric,
      correlation_coefficient: corr.correlation_coefficient,
      p_value: corr.p_value,
      effect_size: corr.effect_size,
      sample_size: corr.sample_size,
      baseline_average: corr.baseline_average,
      post_supplement_average: corr.post_supplement_average,
      improvement_percentage: corr.improvement_percentage,
      confidence_level: corr.confidence_level,
      time_window_days: 30
    }));

    const { error } = await supabase
      .from('health_supplement_correlations')
      .upsert(records, {
        onConflict: 'user_id,supplement_id,health_metric,time_window_days'
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error saving correlation results:', error);
    return false;
  }
}

/**
 * Get stored correlations for a user
 */
export async function getUserCorrelations(userId: string): Promise<CorrelationResult[]> {
  try {
    const { data, error } = await supabase
      .from('health_supplement_correlations')
      .select('*, supplements(name)')
      .eq('user_id', userId)
      .order('confidence_level', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      supplement_id: row.supplement_id,
      supplement_name: (row as any).supplements?.name || 'Unknown',
      health_metric: row.health_metric as HealthMetricType,
      correlation_coefficient: row.correlation_coefficient,
      p_value: row.p_value,
      effect_size: row.effect_size,
      sample_size: row.sample_size,
      baseline_average: row.baseline_average,
      post_supplement_average: row.post_supplement_average,
      improvement_percentage: row.improvement_percentage,
      confidence_level: row.confidence_level,
      is_significant: row.p_value < 0.05
    }));
  } catch (error) {
    console.error('Error fetching user correlations:', error);
    return [];
  }
}
