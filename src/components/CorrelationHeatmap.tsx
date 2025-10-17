// Phase 4: Health Correlation Heatmap Component
// Interactive matrix visualization showing supplement-health metric correlations

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { CorrelationResult } from '../lib/correlationEngine';

interface CorrelationHeatmapProps {
  correlations: CorrelationResult[];
  onCellClick?: (correlation: CorrelationResult) => void;
}

export default function CorrelationHeatmap({ correlations, onCellClick }: CorrelationHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  // Extract unique supplements and metrics
  const { supplements, metrics, heatmapData } = useMemo(() => {
    const suppSet = new Set<string>();
    const metricSet = new Set<string>();
    const dataMap = new Map<string, CorrelationResult>();

    correlations.forEach(corr => {
      suppSet.add(corr.supplement_name);
      metricSet.add(corr.health_metric);
      const key = `${corr.supplement_name}|||${corr.health_metric}`;
      dataMap.set(key, corr);
    });

    return {
      supplements: Array.from(suppSet),
      metrics: Array.from(metricSet),
      heatmapData: dataMap
    };
  }, [correlations]);

  // Get color based on correlation coefficient
  const getColor = (coefficient: number, isSignificant: boolean): string => {
    if (!isSignificant) return 'bg-gray-700/30';

    const intensity = Math.abs(coefficient);

    if (coefficient > 0) {
      // Positive correlation - green gradient
      if (intensity >= 0.7) return 'bg-green-500';
      if (intensity >= 0.5) return 'bg-green-400';
      if (intensity >= 0.3) return 'bg-green-300';
      return 'bg-green-200';
    } else {
      // Negative correlation - red gradient
      if (intensity >= 0.7) return 'bg-red-500';
      if (intensity >= 0.5) return 'bg-red-400';
      if (intensity >= 0.3) return 'bg-red-300';
      return 'bg-red-200';
    }
  };

  // Get cell size based on confidence
  const getCellSize = (confidence: number): string => {
    if (confidence >= 90) return 'w-12 h-12';
    if (confidence >= 70) return 'w-10 h-10';
    if (confidence >= 50) return 'w-8 h-8';
    return 'w-6 h-6';
  };

  const getCorrelation = (supplement: string, metric: string): CorrelationResult | undefined => {
    return heatmapData.get(`${supplement}|||${metric}`);
  };

  if (correlations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white/5 rounded-xl border border-white/10">
        <div className="text-6xl mb-4">📊</div>
        <p className="text-gray-400">No correlation data available</p>
        <p className="text-sm text-gray-500 mt-2">Run correlation analysis to see the heatmap</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">Correlation Heatmap</h3>
          <p className="text-sm text-gray-400 mt-1">
            {correlations.filter(c => c.is_significant).length} significant correlations found
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span className="text-gray-400">Positive</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-gray-400">Negative</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-700/30 rounded"></div>
            <span className="text-gray-400">Not Significant</span>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Column Headers (Metrics) */}
          <div className="flex items-end mb-4 ml-32">
            {metrics.map((metric) => (
              <div
                key={metric}
                className="flex-1 min-w-[80px] text-center"
              >
                <button
                  onClick={() => setSelectedMetric(selectedMetric === metric ? null : metric)}
                  className={`text-xs font-medium transform -rotate-45 origin-bottom-left whitespace-nowrap transition-colors ${
                    selectedMetric === metric ? 'text-blue-400' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {metric}
                </button>
              </div>
            ))}
          </div>

          {/* Rows */}
          {supplements.map((supplement) => (
            <div key={supplement} className="flex items-center mb-3">
              {/* Row Header (Supplement) */}
              <div className="w-32 pr-4 text-right">
                <p className="text-sm font-medium text-gray-300 truncate">{supplement}</p>
              </div>

              {/* Cells */}
              <div className="flex items-center gap-3">
                {metrics.map((metric) => {
                  const corr = getCorrelation(supplement, metric);
                  const cellKey = `${supplement}-${metric}`;
                  const isHovered = hoveredCell === cellKey;
                  const isFiltered = selectedMetric && selectedMetric !== metric;

                  if (!corr) {
                    return (
                      <div key={cellKey} className="flex-1 min-w-[80px] flex items-center justify-center">
                        <div className="w-6 h-6 bg-gray-800/30 rounded"></div>
                      </div>
                    );
                  }

                  return (
                    <div key={cellKey} className="flex-1 min-w-[80px] flex items-center justify-center relative">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => onCellClick?.(corr)}
                        onMouseEnter={() => setHoveredCell(cellKey)}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`${getCellSize(corr.confidence_level)} ${getColor(
                          corr.correlation_coefficient,
                          corr.is_significant
                        )} rounded transition-all ${
                          isFiltered ? 'opacity-30' : 'opacity-100'
                        } ${isHovered ? 'ring-2 ring-blue-400' : ''}`}
                      >
                        {/* Tooltip on hover */}
                        {isHovered && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute z-50 top-full mt-2 left-1/2 transform -translate-x-1/2 bg-gray-900 border border-white/20 rounded-lg p-3 shadow-xl min-w-[200px]"
                          >
                            <div className="text-left text-xs space-y-1">
                              <p className="font-bold text-white">{supplement} ↔ {metric}</p>
                              <div className="border-t border-white/10 my-2"></div>
                              <p className="text-gray-300">
                                Correlation: <span className="font-semibold">{corr.correlation_coefficient.toFixed(3)}</span>
                              </p>
                              <p className="text-gray-300">
                                P-value: <span className="font-semibold">{corr.p_value.toFixed(4)}</span>
                              </p>
                              <p className="text-gray-300">
                                Effect Size: <span className="font-semibold">{corr.effect_size.toFixed(2)}</span>
                              </p>
                              <p className="text-gray-300">
                                Confidence: <span className="font-semibold">{corr.confidence_level.toFixed(0)}%</span>
                              </p>
                              {corr.improvement_percentage !== 0 && (
                                <p className={`font-semibold ${
                                  corr.improvement_percentage > 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {corr.improvement_percentage > 0 ? '+' : ''}{corr.improvement_percentage.toFixed(1)}% change
                                </p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </motion.button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mt-6">
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <p className="text-sm text-gray-400">Total Correlations</p>
          <p className="text-2xl font-bold text-white">{correlations.length}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <p className="text-sm text-gray-400">Significant</p>
          <p className="text-2xl font-bold text-green-400">
            {correlations.filter(c => c.is_significant).length}
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <p className="text-sm text-gray-400">Positive Effects</p>
          <p className="text-2xl font-bold text-green-400">
            {correlations.filter(c => c.is_significant && c.correlation_coefficient > 0).length}
          </p>
        </div>
        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
          <p className="text-sm text-gray-400">Negative Effects</p>
          <p className="text-2xl font-bold text-red-400">
            {correlations.filter(c => c.is_significant && c.correlation_coefficient < 0).length}
          </p>
        </div>
      </div>
    </div>
  );
}
