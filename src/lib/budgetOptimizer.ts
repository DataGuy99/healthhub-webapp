// Phase 3: Budget Optimization Service
// Optimizes health budget allocation across categories for maximum ROI

import { supabase } from './supabase';
import { analyzeAllSupplementsROI, type SupplementROI } from './healthROI';

export interface OptimizedBudget {
  total_budget: number;
  allocation: {
    category: string;
    allocated_amount: number;
    priority: number;
    expected_roi: number;
  }[];
  recommendations: PurchaseRecommendation[];
  projected_savings: number;
  health_impact_projection: number;
}

export interface PurchaseRecommendation {
  item_name: string;
  category: string;
  estimated_cost: number;
  health_impact_score: number;
  priority_score: number;
  reasoning: string;
  optimal_purchase_date: string;
}

export interface PurchaseQueueItem {
  id?: string;
  user_id?: string;
  item_name: string;
  category: string;
  estimated_cost: number;

  health_impact_score: number;
  affordability_score: number;
  timing_optimality_score: number;
  cost_effectiveness_score: number;
  urgency_score: number;

  priority_score: number;
  queue_position: number;

  optimal_purchase_date?: string;
  reasoning?: string;
  alternative_suggestions?: any[];
  notes?: string;

  status?: string;
  supplement_id?: string;

  created_at?: string;
  updated_at?: string;
}

/**
 * Calculate priority score for a purchase item
 */
export function calculatePriorityScore(
  health_impact: number,
  affordability: number,
  timing: number,
  cost_effectiveness: number,
  urgency: number
): number {
  // Weighted scoring: health impact is most important
  const weights = {
    health_impact: 0.35,
    cost_effectiveness: 0.25,
    affordability: 0.20,
    urgency: 0.15,
    timing: 0.05
  };

  return (
    health_impact * weights.health_impact +
    cost_effectiveness * weights.cost_effectiveness +
    affordability * weights.affordability +
    urgency * weights.urgency +
    timing * weights.timing
  );
}

/**
 * Calculate affordability score based on budget availability
 */
export function calculateAffordabilityScore(
  itemCost: number,
  availableBudget: number
): number {
  if (availableBudget <= 0) return 0;
  if (itemCost <= 0) return 100;

  const affordabilityRatio = availableBudget / itemCost;

  if (affordabilityRatio >= 2) return 100; // Can easily afford (2x budget)
  if (affordabilityRatio >= 1) return 80;  // Can afford
  if (affordabilityRatio >= 0.5) return 50; // Need to save
  if (affordabilityRatio >= 0.25) return 25; // Difficult to afford
  return 10; // Very difficult to afford
}

/**
 * Calculate timing optimality score
 * Consider: current inventory, usage rate, seasonal factors
 */
export function calculateTimingScore(
  daysUntilNeeded: number,
  currentInventoryDays: number = 0
): number {
  // Optimal timing: purchase when 7-14 days from running out
  const totalDays = daysUntilNeeded + currentInventoryDays;

  if (totalDays < 0) return 100; // Already out of stock - urgent!
  if (totalDays <= 7) return 90;  // Running low - good time to buy
  if (totalDays <= 14) return 100; // Optimal timing
  if (totalDays <= 30) return 70;  // Can wait a bit
  if (totalDays <= 60) return 40;  // No rush
  return 20; // Too early to purchase
}

/**
 * Calculate urgency score based on health need and inventory
 */
export function calculateUrgencyScore(
  isEssential: boolean,
  daysOfInventoryLeft: number,
  healthImpactScore: number
): number {
  // Base urgency on inventory level
  let urgency = 0;

  if (daysOfInventoryLeft < 0) urgency = 100; // Out of stock
  else if (daysOfInventoryLeft <= 3) urgency = 90;
  else if (daysOfInventoryLeft <= 7) urgency = 70;
  else if (daysOfInventoryLeft <= 14) urgency = 50;
  else if (daysOfInventoryLeft <= 30) urgency = 30;
  else urgency = 10;

  // Boost if essential and high health impact
  if (isEssential && healthImpactScore > 70) {
    urgency = Math.min(100, urgency + 20);
  }

  return urgency;
}

/**
 * Get user's purchase queue
 */
export async function getPurchaseQueue(userId: string): Promise<PurchaseQueueItem[]> {
  try {
    const { data, error } = await supabase
      .from('purchase_queue')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'queued')
      .order('queue_position', { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching purchase queue:', error);
    return [];
  }
}

/**
 * Add item to purchase queue
 */
export async function addToPurchaseQueue(
  userId: string,
  item: Omit<PurchaseQueueItem, 'id' | 'user_id' | 'queue_position' | 'created_at' | 'updated_at' | 'priority_score' | 'affordability_score' | 'cost_effectiveness_score'>
): Promise<boolean> {
  try {
    // Get current max position
    const { data: maxData } = await supabase
      .from('purchase_queue')
      .select('queue_position')
      .eq('user_id', userId)
      .eq('status', 'queued')
      .order('queue_position', { ascending: false })
      .limit(1);

    const nextPosition = maxData && maxData.length > 0 ? maxData[0].queue_position + 1 : 1;

    // Calculate derived scores
    const affordability_score = 50; // Default - will be calculated by budget optimizer
    const cost_effectiveness_score = 50; // Default - will be calculated by correlation engine
    const priority_score = calculatePriorityScore(
      item.health_impact_score,
      affordability_score,
      item.timing_optimality_score,
      cost_effectiveness_score,
      item.urgency_score
    );

    // Insert new item
    const { error } = await supabase
      .from('purchase_queue')
      .insert({
        user_id: userId,
        ...item,
        affordability_score,
        cost_effectiveness_score,
        priority_score,
        queue_position: nextPosition,
        reasoning: item.reasoning || 'User-added item',
        status: 'queued'
      });

    if (error) throw error;

    // Reorder queue by priority
    await reorderQueue(userId);

    return true;
  } catch (error) {
    console.error('Error adding to purchase queue:', error);
    return false;
  }
}

/**
 * Reorder queue based on priority scores
 */
export async function reorderQueue(userId: string): Promise<void> {
  try {
    // Get all queued items sorted by priority
    const { data: items, error } = await supabase
      .from('purchase_queue')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'queued')
      .order('priority_score', { ascending: false });

    if (error) throw error;
    if (!items || items.length === 0) return;

    // Update positions
    const updates = items.map((item, index) => ({
      id: item.id,
      queue_position: index + 1
    }));

    // Batch update positions
    for (const update of updates) {
      await supabase
        .from('purchase_queue')
        .update({ queue_position: update.queue_position })
        .eq('id', update.id);
    }

  } catch (error) {
    console.error('Error reordering queue:', error);
  }
}

/**
 * Mark queue item as purchased
 */
export async function markAsPurchased(
  userId: string,
  queueItemId: string,
  actualCost: number
): Promise<boolean> {
  try {
    // Get queue item details
    const { data: queueItem } = await supabase
      .from('purchase_queue')
      .select('*')
      .eq('id', queueItemId)
      .single();

    if (!queueItem) return false;

    // Update queue item status
    const { error: queueError } = await supabase
      .from('purchase_queue')
      .update({ status: 'purchased' })
      .eq('id', queueItemId);

    if (queueError) throw queueError;

    // Record purchase decision
    const { error: decisionError } = await supabase
      .from('purchase_decisions')
      .insert({
        user_id: userId,
        queue_item_id: queueItemId,
        item_name: queueItem.item_name,
        category: queueItem.category,
        decision: 'purchased',
        reasoning: queueItem.reasoning,
        confidence_score: queueItem.priority_score,
        estimated_cost: queueItem.estimated_cost,
        actual_cost: actualCost
      });

    if (decisionError) throw decisionError;

    // Reorder remaining queue
    await reorderQueue(userId);

    return true;
  } catch (error) {
    console.error('Error marking as purchased:', error);
    return false;
  }
}

/**
 * Generate smart purchase recommendations based on correlations and budget
 */
export async function generatePurchaseRecommendations(
  userId: string,
  availableBudget: number
): Promise<PurchaseRecommendation[]> {
  try {
    // Get ROI analysis for all supplements
    const roiAnalyses = await analyzeAllSupplementsROI(userId);

    // Filter to supplements with increase/maintain recommendations
    const worthwhileSupplements = roiAnalyses.filter(
      roi => roi.recommendation === 'increase' || roi.recommendation === 'maintain'
    );

    // Generate recommendations
    const recommendations: PurchaseRecommendation[] = worthwhileSupplements
      .map(roi => {
        const affordability = calculateAffordabilityScore(roi.monthly_cost, availableBudget);
        const health_impact = Math.min(100, roi.roi_percentage / 2); // Scale ROI to 0-100
        const cost_effectiveness = Math.min(100, roi.roi_percentage);

        return {
          item_name: roi.supplement_name,
          category: 'supplements',
          estimated_cost: roi.monthly_cost,
          health_impact_score: health_impact,
          priority_score: calculatePriorityScore(
            health_impact,
            affordability,
            50, // neutral timing
            cost_effectiveness,
            30  // low urgency
          ),
          reasoning: `ROI: ${roi.roi_percentage.toFixed(0)}% - ${roi.recommendation}. Health value: $${roi.total_health_value.toFixed(0)}/month.`,
          optimal_purchase_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 days from now
        };
      })
      .sort((a, b) => b.priority_score - a.priority_score);

    return recommendations;

  } catch (error) {
    console.error('Error generating purchase recommendations:', error);
    return [];
  }
}

/**
 * Optimize budget allocation across categories
 */
export async function optimizeHealthBudget(
  userId: string,
  totalBudget: number
): Promise<OptimizedBudget> {
  try {
    // Get ROI analyses
    const roiAnalyses = await analyzeAllSupplementsROI(userId);

    // Calculate total ROI-weighted spending
    const totalROIWeightedSpending = roiAnalyses.reduce(
      (sum, roi) => sum + (roi.monthly_cost * Math.max(1, roi.roi_percentage / 100)),
      0
    );

    // Allocate budget proportionally to ROI
    const allocation = roiAnalyses
      .filter(roi => roi.recommendation !== 'eliminate')
      .map(roi => ({
        category: roi.supplement_name,
        allocated_amount: totalBudget * (roi.monthly_cost * Math.max(1, roi.roi_percentage / 100)) / totalROIWeightedSpending,
        priority: roi.recommendation === 'increase' ? 5 : roi.recommendation === 'maintain' ? 3 : 1,
        expected_roi: roi.roi_percentage
      }))
      .sort((a, b) => b.priority - a.priority);

    // Generate recommendations
    const recommendations = await generatePurchaseRecommendations(userId, totalBudget);

    // Calculate projected savings (difference from current spending)
    const currentSpending = roiAnalyses.reduce((sum, roi) => sum + roi.monthly_cost, 0);
    const optimizedSpending = allocation.reduce((sum, a) => sum + a.allocated_amount, 0);
    const projected_savings = currentSpending - Math.min(optimizedSpending, totalBudget);

    // Calculate projected health impact (total health value)
    const health_impact_projection = roiAnalyses.reduce(
      (sum, roi) => sum + roi.total_health_value,
      0
    );

    return {
      total_budget: totalBudget,
      allocation,
      recommendations,
      projected_savings,
      health_impact_projection
    };

  } catch (error) {
    console.error('Error optimizing health budget:', error);
    return {
      total_budget: totalBudget,
      allocation: [],
      recommendations: [],
      projected_savings: 0,
      health_impact_projection: 0
    };
  }
}
