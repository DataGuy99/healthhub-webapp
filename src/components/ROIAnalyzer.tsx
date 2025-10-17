// Phase 3: ROI Analyzer Component
// Visualizes health ROI analysis and optimization recommendations

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  analyzeAllSupplementsROI,
  calculateOptimizationPotential,
  type SupplementROI
} from '../lib/healthROI';

interface ROIAnalyzerProps {
  userId: string;
}

export default function ROIAnalyzer({ userId }: ROIAnalyzerProps) {
  const [roiData, setRoiData] = useState<SupplementROI[]>([]);
  const [optimization, setOptimization] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'roi' | 'optimization'>('roi');

  useEffect(() => {
    loadROIData();
  }, [userId]);

  const loadROIData = async () => {
    setLoading(true);
    const [roi, opt] = await Promise.all([
      analyzeAllSupplementsROI(userId),
      calculateOptimizationPotential(userId)
    ]);
    setRoiData(roi);
    setOptimization(opt);
    setLoading(false);
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'increase': return 'bg-green-500';
      case 'maintain': return 'bg-blue-500';
      case 'reduce': return 'bg-yellow-500';
      case 'eliminate': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getRecommendationIcon = (rec: string) => {
    switch (rec) {
      case 'increase': return '📈';
      case 'maintain': return '✅';
      case 'reduce': return '📉';
      case 'eliminate': return '❌';
      default: return '❓';
    }
  };

  const getROILabel = (percentage: number) => {
    if (percentage > 200) return 'Excellent';
    if (percentage > 100) return 'Good';
    if (percentage > 50) return 'Fair';
    if (percentage > 0) return 'Poor';
    return 'No Data';
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
      {/* Header & View Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Health ROI Analysis</h2>
          <p className="text-gray-400 mt-1">Return on investment for your health spending</p>
        </div>
        <div className="flex gap-2 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setActiveView('roi')}
            className={`px-4 py-2 rounded-md transition-all ${
              activeView === 'roi'
                ? 'bg-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            ROI Analysis
          </button>
          <button
            onClick={() => setActiveView('optimization')}
            className={`px-4 py-2 rounded-md transition-all ${
              activeView === 'optimization'
                ? 'bg-blue-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Optimization
          </button>
        </div>
      </div>

      {/* ROI Analysis View */}
      {activeView === 'roi' && (
        <div className="space-y-4">
          {roiData.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📊</div>
              <p className="text-gray-400">No ROI data available</p>
              <p className="text-sm text-gray-500 mt-2">
                Run correlation analysis to calculate supplement ROI
              </p>
            </div>
          ) : (
            roiData.map((roi, index) => (
              <motion.div
                key={roi.supplement_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white">{roi.supplement_name}</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      ${roi.monthly_cost.toFixed(2)}/month
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getRecommendationIcon(roi.recommendation)}</span>
                      <span className={`${getRecommendationColor(roi.recommendation)} text-white text-sm px-3 py-1 rounded-full capitalize`}>
                        {roi.recommendation}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{getROILabel(roi.roi_percentage)}</p>
                  </div>
                </div>

                {/* ROI Metrics */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-gray-400">ROI</p>
                    <p className="text-2xl font-bold text-blue-400">{roi.roi_percentage.toFixed(0)}%</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-gray-400">Health Value</p>
                    <p className="text-2xl font-bold text-green-400">${roi.total_health_value.toFixed(0)}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-gray-400">Cost/Point</p>
                    <p className="text-2xl font-bold text-yellow-400">${roi.cost_per_health_point.toFixed(2)}</p>
                  </div>
                </div>

                {/* Health Benefits */}
                {roi.health_benefits.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-white mb-2">Health Benefits:</p>
                    <div className="space-y-2">
                      {roi.health_benefits.map((benefit, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                          <div className="flex-1">
                            <p className="text-sm text-white font-medium">{benefit.metric}</p>
                            <p className="text-xs text-gray-400">
                              {benefit.improvement_percentage > 0 ? '+' : ''}
                              {benefit.improvement_percentage.toFixed(1)}% improvement
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-green-400">${benefit.monetary_value.toFixed(0)}</p>
                            <p className="text-xs text-gray-400">{benefit.confidence_level.toFixed(0)}% confidence</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Optimization View */}
      {activeView === 'optimization' && optimization && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl p-6 border border-blue-500/30">
              <p className="text-sm text-blue-300 mb-1">Current Spending</p>
              <p className="text-3xl font-bold text-white">${optimization.current_monthly_spending.toFixed(2)}</p>
              <p className="text-xs text-blue-200 mt-1">per month</p>
            </div>
            <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl p-6 border border-green-500/30">
              <p className="text-sm text-green-300 mb-1">Optimized Spending</p>
              <p className="text-3xl font-bold text-white">${optimization.optimized_monthly_spending.toFixed(2)}</p>
              <p className="text-xs text-green-200 mt-1">per month</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl p-6 border border-purple-500/30">
              <p className="text-sm text-purple-300 mb-1">Potential Savings</p>
              <p className="text-3xl font-bold text-white">${optimization.potential_savings.toFixed(2)}</p>
              <p className="text-xs text-purple-200 mt-1">{optimization.savings_percentage.toFixed(1)}% reduction</p>
            </div>
          </div>

          {/* Recommendations */}
          <div>
            <h3 className="text-xl font-bold text-white mb-4">Optimization Recommendations</h3>
            {optimization.recommendations.length === 0 ? (
              <div className="text-center py-8 bg-white/5 rounded-xl">
                <p className="text-gray-400">Your spending is already optimized! 🎉</p>
              </div>
            ) : (
              <div className="space-y-3">
                {optimization.recommendations.map((rec: any, index: number) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className={`${
                            rec.action === 'Eliminate' ? 'bg-red-500' : 'bg-yellow-500'
                          } text-white text-xs px-3 py-1 rounded-full`}>
                            {rec.action}
                          </span>
                          <h4 className="text-lg font-semibold text-white">{rec.item}</h4>
                        </div>
                        <p className="text-sm text-gray-400 mt-2">
                          Current cost: ${rec.current_cost.toFixed(2)}/month
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Potential Savings</p>
                        <p className="text-2xl font-bold text-green-400">${rec.savings.toFixed(2)}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl p-6 border border-blue-500/30">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-bold text-white">Ready to optimize?</h4>
                <p className="text-sm text-gray-300 mt-1">
                  Save ${optimization.potential_savings.toFixed(2)}/month while maintaining health benefits
                </p>
              </div>
              <button className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-all">
                Apply Recommendations
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
