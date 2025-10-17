// Phase 4: Smart Purchase Funnel Visualization
// Dynamic funnel showing the 5-stage purchase decision process

import { motion } from 'framer-motion';
import type { PurchaseQueueItem } from '../lib/budgetOptimizer';

interface PurchaseFunnelProps {
  queueItems: PurchaseQueueItem[];
  onItemClick?: (item: PurchaseQueueItem) => void;
}

interface FunnelStage {
  id: string;
  label: string;
  color: string;
  icon: string;
  getScore: (item: PurchaseQueueItem) => number;
}

const FUNNEL_STAGES: FunnelStage[] = [
  {
    id: 'health',
    label: 'Health Impact',
    color: 'from-red-500 to-pink-500',
    icon: '❤️',
    getScore: (item) => item.health_impact_score
  },
  {
    id: 'budget',
    label: 'Budget Check',
    color: 'from-blue-500 to-cyan-500',
    icon: '💰',
    getScore: (item) => item.affordability_score
  },
  {
    id: 'roi',
    label: 'Cost-Effectiveness',
    color: 'from-purple-500 to-violet-500',
    icon: '📊',
    getScore: (item) => item.cost_effectiveness_score
  },
  {
    id: 'timing',
    label: 'Timing',
    color: 'from-orange-500 to-amber-500',
    icon: '⏰',
    getScore: (item) => item.timing_optimality_score
  },
  {
    id: 'urgency',
    label: 'Urgency',
    color: 'from-green-500 to-emerald-500',
    icon: '🚀',
    getScore: (item) => item.urgency_score
  }
];

export default function PurchaseFunnel({ queueItems, onItemClick }: PurchaseFunnelProps) {
  const topItems = queueItems.slice(0, 5); // Show top 5 items

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getBarWidth = (score: number): string => {
    return `${score}%`;
  };

  if (queueItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white/5 rounded-xl border border-white/10">
        <div className="text-6xl mb-4">🎯</div>
        <p className="text-gray-400">No items in purchase queue</p>
        <p className="text-sm text-gray-500 mt-2">Add items to see the funnel analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-bold text-white">Purchase Decision Funnel</h3>
        <p className="text-sm text-gray-400 mt-1">
          5-stage analysis for top {topItems.length} priority items
        </p>
      </div>

      {/* Funnel Visualization */}
      <div className="space-y-6">
        {topItems.map((item, itemIndex) => (
          <motion.div
            key={item.id || itemIndex}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: itemIndex * 0.1 }}
            onClick={() => onItemClick?.(item)}
            className="bg-white/5 rounded-xl p-6 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
          >
            {/* Item Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                  #{item.queue_position}
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-white">{item.item_name}</h4>
                  <p className="text-sm text-gray-400">{item.category}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Est. Cost</p>
                <p className="text-xl font-bold text-white">${item.estimated_cost.toFixed(2)}</p>
              </div>
            </div>

            {/* Funnel Stages */}
            <div className="space-y-3">
              {FUNNEL_STAGES.map((stage, stageIndex) => {
                const score = stage.getScore(item);
                const width = getBarWidth(score);

                return (
                  <div key={stage.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{stage.icon}</span>
                        <span className="text-sm text-gray-300">{stage.label}</span>
                      </div>
                      <span className={`text-sm font-bold ${getScoreColor(score)}`}>
                        {score.toFixed(0)}
                      </span>
                    </div>
                    <div className="relative h-6 bg-gray-800/50 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width }}
                        transition={{ duration: 0.5, delay: itemIndex * 0.1 + stageIndex * 0.05 }}
                        className={`absolute inset-y-0 left-0 bg-gradient-to-r ${stage.color} rounded-full`}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-medium text-white/80">{score.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Final Priority Score */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Final Priority Score</p>
                  <p className="text-xs text-gray-500 mt-1">{item.reasoning}</p>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-bold ${getScoreColor(item.priority_score)}`}>
                    {item.priority_score.toFixed(0)}
                  </p>
                  <p className="text-xs text-gray-400">out of 100</p>
                </div>
              </div>
            </div>

            {/* Optimal Date */}
            {item.optimal_purchase_date && (
              <div className="mt-3 bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <span className="text-blue-400">📅</span>
                  <p className="text-sm text-blue-300">
                    Optimal purchase date: <span className="font-semibold">{item.optimal_purchase_date}</span>
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Funnel Summary */}
      <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl p-6 border border-blue-500/30">
        <h4 className="text-lg font-bold text-white mb-4">Funnel Insights</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-300 mb-2">Average Scores:</p>
            <div className="space-y-1 text-xs">
              {FUNNEL_STAGES.map(stage => {
                const avgScore = topItems.reduce((sum, item) => sum + stage.getScore(item), 0) / topItems.length;
                return (
                  <div key={stage.id} className="flex justify-between">
                    <span className="text-gray-400">{stage.icon} {stage.label}:</span>
                    <span className={`font-semibold ${getScoreColor(avgScore)}`}>
                      {avgScore.toFixed(0)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-300 mb-2">Decision Metrics:</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-400">Items Ready:</span>
                <span className="font-semibold text-green-400">
                  {topItems.filter(i => i.affordability_score >= 50).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">High Impact:</span>
                <span className="font-semibold text-blue-400">
                  {topItems.filter(i => i.health_impact_score >= 70).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Urgent:</span>
                <span className="font-semibold text-orange-400">
                  {topItems.filter(i => i.urgency_score >= 70).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Optimal Timing:</span>
                <span className="font-semibold text-purple-400">
                  {topItems.filter(i => i.timing_optimality_score >= 70).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
