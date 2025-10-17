// Phase 2: Health Insights Component - Display correlation findings and recommendations
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { analyzeAllCorrelations, saveCorrelationResults, getUserCorrelations, type CorrelationResult } from '../lib/correlationEngine';

interface Insight {
  id: string;
  type: 'supplement' | 'health' | 'budget' | 'timing' | 'correlation';
  title: string;
  description: string;
  confidence: number;
  priority: number;
  actionable: boolean;
  action?: string;
}

export function HealthInsights() {
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [correlations, setCorrelations] = useState<CorrelationResult[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Load existing correlations
      const existingCorrelations = await getUserCorrelations(user.id);
      setCorrelations(existingCorrelations);

      // Generate insights from correlations
      const generatedInsights = generateInsightsFromCorrelations(existingCorrelations);
      setInsights(generatedInsights);

      setLoading(false);
    } catch (error) {
      console.error('Error loading insights data');
      setLoading(false);
    }
  };

  const runCorrelationAnalysis = async () => {
    try {
      setAnalyzing(true);
      const user = await getCurrentUser();
      if (!user) return;

      // Run full correlation analysis
      const results = await analyzeAllCorrelations(user.id, 30);

      if (results.length > 0) {
        // Save results to database
        await saveCorrelationResults(user.id, results);

        // Update state
        setCorrelations(results);

        // Generate new insights
        const generatedInsights = generateInsightsFromCorrelations(results);
        setInsights(generatedInsights);
      }

      setAnalyzing(false);
    } catch (error) {
      console.error('Error running correlation analysis');
      setAnalyzing(false);
    }
  };

  const generateInsightsFromCorrelations = (correlations: CorrelationResult[]): Insight[] => {
    const insights: Insight[] = [];

    correlations.forEach(corr => {
      if (corr.is_significant && corr.improvement_percentage !== 0) {
        const improvementDirection = corr.improvement_percentage > 0 ? 'increased' : 'decreased';
        const improvementMagnitude = Math.abs(corr.improvement_percentage);

        insights.push({
          id: `corr-${corr.supplement_id}-${corr.health_metric}`,
          type: 'correlation',
          title: `${corr.supplement_name} ↔ ${corr.health_metric.replace(/_/g, ' ')}`,
          description: `Taking ${corr.supplement_name} is associated with a ${improvementMagnitude.toFixed(1)}% ${improvementDirection} in ${corr.health_metric.replace(/_/g, ' ')}. Correlation: ${corr.correlation_coefficient.toFixed(2)}, Confidence: ${corr.confidence_level.toFixed(0)}%`,
          confidence: corr.confidence_level / 100,
          priority: Math.abs(corr.correlation_coefficient) * 10,
          actionable: true,
          action: corr.improvement_percentage > 0 ? 'Continue taking' : 'Consider adjusting'
        });
      }
    });

    // Sort by priority (highest first)
    insights.sort((a, b) => b.priority - a.priority);

    return insights;
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'text-green-400 bg-green-500/20';
    if (confidence >= 0.6) return 'text-yellow-400 bg-yellow-500/20';
    return 'text-orange-400 bg-orange-500/20';
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Loading insights...</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Health Insights</h2>
          <p className="text-white/60">
            AI-powered correlations between supplements and health metrics
          </p>
        </div>
        <button
          onClick={runCorrelationAnalysis}
          disabled={analyzing}
          className="px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl font-semibold hover:from-violet-600 hover:to-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {analyzing ? '🔄 Analyzing...' : '🧠 Run Analysis'}
        </button>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <div className="text-white/60 text-sm mb-2">Total Correlations</div>
          <div className="text-3xl font-bold text-white">{correlations.length}</div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <div className="text-white/60 text-sm mb-2">Significant Findings</div>
          <div className="text-3xl font-bold text-green-400">
            {correlations.filter(c => c.is_significant).length}
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <div className="text-white/60 text-sm mb-2">Actionable Insights</div>
          <div className="text-3xl font-bold text-blue-400">
            {insights.filter(i => i.actionable).length}
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <div className="text-white/60 text-sm mb-2">Avg Confidence</div>
          <div className="text-3xl font-bold text-purple-400">
            {correlations.length > 0
              ? ((correlations.reduce((sum, c) => sum + c.confidence_level, 0) / correlations.length)).toFixed(0)
              : 0}%
          </div>
        </div>
      </div>

      {/* Insights List */}
      {insights.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 text-center">
          <div className="text-5xl mb-4">🔬</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Insights Yet</h3>
          <p className="text-white/60 mb-4">
            Run a correlation analysis to discover relationships between your supplements and health metrics.
          </p>
          <p className="text-sm text-white/40">
            Requires at least 30 days of health data and supplement logs.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((insight, idx) => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 hover:bg-white/10 transition-all cursor-pointer"
              onClick={() => setSelectedInsight(insight)}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{insight.title}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getConfidenceColor(insight.confidence)}`}>
                      {getConfidenceLabel(insight.confidence)} Confidence
                    </span>
                  </div>
                  <p className="text-white/70 text-sm mb-3">{insight.description}</p>
                  {insight.actionable && insight.action && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-violet-400 font-semibold">→ Action:</span>
                      <span className="text-white/80">{insight.action}</span>
                    </div>
                  )}
                </div>

                {/* Priority Indicator */}
                <div className="flex flex-col items-center gap-1">
                  <div className="text-2xl">
                    {insight.priority >= 7 ? '🔥' : insight.priority >= 5 ? '⭐' : '💡'}
                  </div>
                  <div className="text-xs text-white/40">
                    P{insight.priority.toFixed(0)}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Top Correlations Table */}
      {correlations.length > 0 && (
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Top Correlations</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-sm text-white/60 pb-3 pr-4">Supplement</th>
                  <th className="text-left text-sm text-white/60 pb-3 pr-4">Health Metric</th>
                  <th className="text-center text-sm text-white/60 pb-3 pr-4">Correlation</th>
                  <th className="text-center text-sm text-white/60 pb-3 pr-4">Improvement</th>
                  <th className="text-center text-sm text-white/60 pb-3 pr-4">Confidence</th>
                  <th className="text-center text-sm text-white/60 pb-3">P-Value</th>
                </tr>
              </thead>
              <tbody>
                {correlations.slice(0, 10).map((corr, idx) => (
                  <tr key={idx} className="border-b border-white/5">
                    <td className="py-3 pr-4 text-white">{corr.supplement_name}</td>
                    <td className="py-3 pr-4 text-white/80 capitalize">
                      {corr.health_metric.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <span className={corr.correlation_coefficient > 0 ? 'text-green-400' : 'text-red-400'}>
                        {corr.correlation_coefficient.toFixed(3)}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <span className={corr.improvement_percentage > 0 ? 'text-green-400' : 'text-red-400'}>
                        {corr.improvement_percentage > 0 ? '+' : ''}{corr.improvement_percentage.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-center text-white">
                      {corr.confidence_level.toFixed(0)}%
                    </td>
                    <td className="py-3 text-center">
                      <span className={corr.p_value < 0.05 ? 'text-green-400' : 'text-orange-400'}>
                        {corr.p_value.toFixed(4)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </motion.div>
  );
}
