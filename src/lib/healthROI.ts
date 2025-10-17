// Phase 3: Health ROI Analysis Engine
// Calculates return on investment for health-related purchases

import { supabase } from './supabase';
import { getUserCorrelations, type CorrelationResult } from './correlationEngine';

export interface SupplementROI {
  supplement_id: string;
  supplement_name: string;
  monthly_cost: number;

  health_benefits: {
    metric: string;
    improvement_amount: number;
    improvement_percentage: number;
    confidence_level: number;
    monetary_value: number; // Estimated value of improvement
  }[];

  total_health_value: number;
  cost_per_health_point: number;
  roi_percentage: number;
  recommendation: 'increase' | 'maintain' | 'reduce' | 'eliminate' | 'insufficient_data';

  alternatives?: {
    supplement_name: string;
    cost_difference: number;
    effectiveness_difference: number;
    switch_recommendation: string;
  }[];
}

export interface BudgetAllocation {
  category: string;
  monthly_budget: number;
  health_priority: number; // 1-5 scale
  roi_target?: number;
  current_spending: number;
}

/**
 * Calculate monetary value of health improvement
 * Simplified model: Each 1% improvement in a metric = $1 value
 * Can be enhanced with QALY (Quality Adjusted Life Years) calculations
 */
function calculateHealthValue(
  improvement_percentage: number,
  confidence_level: number
): number {
  // Base value: 1% improvement = $1
  const baseValue = Math.abs(improvement_percentage);

  // Weight by confidence (high confidence = full value, low confidence = reduced)
  const confidenceWeight = confidence_level / 100;

  return baseValue * confidenceWeight;
}

/**
 * Analyze ROI for a specific supplement
 */
export async function analyzeSupplementROI(
  userId: string,
  supplementId: string
): Promise<SupplementROI | null> {
  try {
    // Get supplement details
    const { data: supplement, error: suppError } = await supabase
      .from('supplements')
      .select('*')
      .eq('id', supplementId)
      .eq('user_id', userId)
      .single();

    if (suppError || !supplement) {
      console.error('Error fetching supplement:', suppError);
      return null;
    }

    // Get correlations for this supplement
    const allCorrelations = await getUserCorrelations(userId);
    const supplementCorrelations = allCorrelations.filter(
      c => c.supplement_id === supplementId && c.is_significant
    );

    if (supplementCorrelations.length === 0) {
      return {
        supplement_id: supplementId,
        supplement_name: supplement.name,
        monthly_cost: supplement.monthly_cost || estimateMonthlyCost(supplement),
        health_benefits: [],
        total_health_value: 0,
        cost_per_health_point: 0,
        roi_percentage: 0,
        recommendation: 'insufficient_data'
      };
    }

    // Calculate health benefits from correlations
    const health_benefits = supplementCorrelations.map(corr => ({
      metric: corr.health_metric,
      improvement_amount: corr.post_supplement_average - corr.baseline_average,
      improvement_percentage: corr.improvement_percentage,
      confidence_level: corr.confidence_level,
      monetary_value: calculateHealthValue(corr.improvement_percentage, corr.confidence_level)
    }));

    // Sum total health value
    const total_health_value = health_benefits.reduce(
      (sum, benefit) => sum + benefit.monetary_value,
      0
    );

    // Calculate monthly cost
    const monthly_cost = supplement.monthly_cost || estimateMonthlyCost(supplement);

    // Calculate ROI metrics
    const cost_per_health_point = monthly_cost > 0 ? monthly_cost / total_health_value : 0;
    const roi_percentage = monthly_cost > 0 ? (total_health_value / monthly_cost) * 100 : 0;

    // Generate recommendation
    let recommendation: SupplementROI['recommendation'];
    if (roi_percentage > 200) {
      recommendation = 'increase';
    } else if (roi_percentage > 100) {
      recommendation = 'maintain';
    } else if (roi_percentage > 50) {
      recommendation = 'reduce';
    } else if (roi_percentage > 0) {
      recommendation = 'eliminate';
    } else {
      recommendation = 'insufficient_data';
    }

    return {
      supplement_id: supplementId,
      supplement_name: supplement.name,
      monthly_cost,
      health_benefits,
      total_health_value,
      cost_per_health_point,
      roi_percentage,
      recommendation
    };

  } catch (error) {
    console.error('Error analyzing supplement ROI:', error);
    return null;
  }
}

/**
 * Estimate monthly cost from supplement data
 */
function estimateMonthlyCost(supplement: any): number {
  if (supplement.monthly_cost) return supplement.monthly_cost;

  // Estimate from cost and frequency
  if (supplement.cost && supplement.frequency) {
    return supplement.cost * (30 / supplement.frequency);
  }

  return 0;
}

/**
 * Analyze ROI for all supplements
 */
export async function analyzeAllSupplementsROI(userId: string): Promise<SupplementROI[]> {
  try {
    // Get all user's supplements
    const { data: supplements, error } = await supabase
      .from('supplements')
      .select('id, name')
      .eq('user_id', userId)
      .eq('is_stack', false); // Only individual supplements

    if (error || !supplements) {
      console.error('Error fetching supplements:', error);
      return [];
    }

    // Analyze ROI for each supplement
    const roiAnalyses = await Promise.all(
      supplements.map(s => analyzeSupplementROI(userId, s.id))
    );

    // Filter out nulls and sort by ROI
    return roiAnalyses
      .filter((roi): roi is SupplementROI => roi !== null)
      .sort((a, b) => b.roi_percentage - a.roi_percentage);

  } catch (error) {
    console.error('Error analyzing all supplements ROI:', error);
    return [];
  }
}

/**
 * Get budget allocations for user
 */
export async function getBudgetAllocations(userId: string): Promise<BudgetAllocation[]> {
  try {
    const { data, error } = await supabase
      .from('health_budget_allocations')
      .select('*')
      .eq('user_id', userId)
      .order('health_priority', { ascending: false });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching budget allocations:', error);
    return [];
  }
}

/**
 * Save or update budget allocation
 */
export async function saveBudgetAllocation(
  userId: string,
  allocation: Omit<BudgetAllocation, 'current_spending'>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('health_budget_allocations')
      .upsert({
        user_id: userId,
        category: allocation.category,
        monthly_budget: allocation.monthly_budget,
        health_priority: allocation.health_priority,
        roi_target: allocation.roi_target
      }, {
        onConflict: 'user_id,category'
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error saving budget allocation:', error);
    return false;
  }
}

/**
 * Calculate total health spending optimization potential
 */
export async function calculateOptimizationPotential(userId: string): Promise<{
  current_monthly_spending: number;
  optimized_monthly_spending: number;
  potential_savings: number;
  savings_percentage: number;
  recommendations: {
    action: string;
    item: string;
    current_cost: number;
    savings: number;
  }[];
}> {
  const roiAnalyses = await analyzeAllSupplementsROI(userId);

  let current_spending = 0;
  let optimized_spending = 0;
  const recommendations: any[] = [];

  roiAnalyses.forEach(roi => {
    current_spending += roi.monthly_cost;

    if (roi.recommendation === 'eliminate') {
      // Eliminate = save full cost
      optimized_spending += 0;
      recommendations.push({
        action: 'Eliminate',
        item: roi.supplement_name,
        current_cost: roi.monthly_cost,
        savings: roi.monthly_cost
      });
    } else if (roi.recommendation === 'reduce') {
      // Reduce = save 50% of cost
      const reduced_cost = roi.monthly_cost * 0.5;
      optimized_spending += reduced_cost;
      recommendations.push({
        action: 'Reduce dosage by 50%',
        item: roi.supplement_name,
        current_cost: roi.monthly_cost,
        savings: roi.monthly_cost - reduced_cost
      });
    } else {
      // Maintain or increase = keep current cost
      optimized_spending += roi.monthly_cost;
    }
  });

  const potential_savings = current_spending - optimized_spending;
  const savings_percentage = current_spending > 0
    ? (potential_savings / current_spending) * 100
    : 0;

  return {
    current_monthly_spending: current_spending,
    optimized_monthly_spending: optimized_spending,
    potential_savings,
    savings_percentage,
    recommendations
  };
}
