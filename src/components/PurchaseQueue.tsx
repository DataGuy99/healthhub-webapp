// Phase 3: Smart Purchase Queue Component
// Displays prioritized purchase recommendations with interactive queue management

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import {
  getPurchaseQueue,
  addToPurchaseQueue,
  markAsPurchased,
  type PurchaseQueueItem
} from '../lib/budgetOptimizer';

interface PurchaseQueueProps {
  userId: string;
  availableBudget?: number;
}

export default function PurchaseQueue({ userId, availableBudget = 0 }: PurchaseQueueProps) {
  const [queueItems, setQueueItems] = useState<PurchaseQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<PurchaseQueueItem | null>(null);
  const [purchasingItemId, setPurchasingItemId] = useState<string | null>(null);

  useEffect(() => {
    loadQueue();
  }, [userId]);

  const loadQueue = async () => {
    setLoading(true);
    const items = await getPurchaseQueue(userId);
    setQueueItems(items);
    setLoading(false);
  };

  const handlePurchase = async (item: PurchaseQueueItem, actualCost: number) => {
    if (!item.id) return;

    setPurchasingItemId(item.id);
    const success = await markAsPurchased(userId, item.id, actualCost);

    if (success) {
      await loadQueue();
      setSelectedItem(null);
    }
    setPurchasingItemId(null);
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getPriorityBadge = (priority: number) => {
    if (priority >= 80) return { label: 'Critical', color: 'bg-red-500' };
    if (priority >= 60) return { label: 'High', color: 'bg-orange-500' };
    if (priority >= 40) return { label: 'Medium', color: 'bg-yellow-500' };
    return { label: 'Low', color: 'bg-gray-500' };
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Soon';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const calculateAffordability = (cost: number) => {
    if (availableBudget <= 0) return 0;
    const ratio = availableBudget / cost;
    if (ratio >= 2) return 100;
    if (ratio >= 1) return 80;
    if (ratio >= 0.5) return 50;
    return 25;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Smart Purchase Queue</h2>
          <p className="text-gray-400 mt-1">
            {queueItems.length} items prioritized by health ROI
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">Available Budget</p>
          <p className="text-2xl font-bold text-white">${availableBudget.toFixed(2)}</p>
        </div>
      </div>

      {/* Queue Items */}
      {queueItems.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🎯</div>
          <p className="text-gray-400">Your purchase queue is empty</p>
          <p className="text-sm text-gray-500 mt-2">
            Run correlation analysis to get personalized recommendations
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {queueItems.map((item, index) => {
              const badge = getPriorityBadge(item.priority_score);
              const affordability = calculateAffordability(item.estimated_cost);
              const canAfford = affordability >= 50;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex items-start justify-between">
                    {/* Left: Item Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="text-2xl font-bold text-white">#{item.queue_position}</div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">{item.item_name}</h3>
                          <p className="text-sm text-gray-400">{item.category}</p>
                        </div>
                        <span className={`${badge.color} text-white text-xs px-2 py-1 rounded-full`}>
                          {badge.label}
                        </span>
                      </div>

                      {/* Score Breakdown */}
                      <div className="grid grid-cols-5 gap-3 mt-4">
                        <div className="text-center">
                          <p className="text-xs text-gray-400">Health</p>
                          <p className={`text-lg font-bold ${getScoreColor(item.health_impact_score)}`}>
                            {item.health_impact_score.toFixed(0)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-400">Cost Eff.</p>
                          <p className={`text-lg font-bold ${getScoreColor(item.cost_effectiveness_score)}`}>
                            {item.cost_effectiveness_score.toFixed(0)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-400">Afford.</p>
                          <p className={`text-lg font-bold ${getScoreColor(item.affordability_score)}`}>
                            {item.affordability_score.toFixed(0)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-400">Timing</p>
                          <p className={`text-lg font-bold ${getScoreColor(item.timing_optimality_score)}`}>
                            {item.timing_optimality_score.toFixed(0)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-400">Urgency</p>
                          <p className={`text-lg font-bold ${getScoreColor(item.urgency_score)}`}>
                            {item.urgency_score.toFixed(0)}
                          </p>
                        </div>
                      </div>

                      {/* Reasoning */}
                      <p className="text-sm text-gray-300 mt-4 bg-white/5 rounded-lg p-3">
                        💡 {item.reasoning}
                      </p>
                    </div>

                    {/* Right: Actions */}
                    <div className="ml-6 text-right space-y-3">
                      <div>
                        <p className="text-sm text-gray-400">Estimated Cost</p>
                        <p className="text-2xl font-bold text-white">${item.estimated_cost.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Optimal Date</p>
                        <p className="text-sm font-semibold text-blue-400">
                          {formatDate(item.optimal_purchase_date)}
                        </p>
                      </div>
                      <div className="space-y-2 pt-2">
                        <button
                          onClick={() => setSelectedItem(item)}
                          disabled={!canAfford || purchasingItemId === item.id}
                          className={`w-full px-4 py-2 rounded-lg font-semibold transition-all ${
                            canAfford
                              ? 'bg-blue-500 hover:bg-blue-600 text-white'
                              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                          }`}
                        >
                          {purchasingItemId === item.id ? 'Processing...' : 'Purchase'}
                        </button>
                        {!canAfford && (
                          <p className="text-xs text-red-400">Insufficient budget</p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Purchase Confirmation Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 border border-white/20"
          >
            <h3 className="text-xl font-bold text-white mb-4">Confirm Purchase</h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-400">Item:</span>
                <span className="text-white font-semibold">{selectedItem.item_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Estimated Cost:</span>
                <span className="text-white">${selectedItem.estimated_cost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Priority Score:</span>
                <span className="text-blue-400 font-bold">{selectedItem.priority_score.toFixed(0)}/100</span>
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">Actual Cost Paid</label>
              <input
                type="number"
                step="0.01"
                defaultValue={selectedItem.estimated_cost}
                id="actual-cost-input"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedItem(null)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById('actual-cost-input') as HTMLInputElement;
                  const actualCost = parseFloat(input.value) || selectedItem.estimated_cost;
                  handlePurchase(selectedItem, actualCost);
                }}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-all"
              >
                Confirm Purchase
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
