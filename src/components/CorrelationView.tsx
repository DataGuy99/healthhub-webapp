import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'framer-motion';
import { db } from '../lib/db';
import { calculateAllCorrelations, getCorrelationStrength } from '../lib/correlation';

export function CorrelationView() {
  const [calculating, setCalculating] = useState(false);

  const correlations = useLiveQuery(() =>
    db.correlations.orderBy('coefficient').reverse().toArray()
  );

  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async () => {
    setCalculating(true);
    setError(null);
    try {
      await calculateAllCorrelations(30);
    } catch (err) {
      console.error('Failed to calculate correlations:', err);
      setError((err as Error).message || 'Failed to calculate correlations');
    } finally {
      setCalculating(false);
    }
  };

  return (
    <div className="relative max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Correlation Analysis</h2>
        <p className="text-white/70 mb-4">Discover relationships between your health metrics</p>
        <button
          onClick={handleCalculate}
          disabled={calculating}
          className="px-6 py-3 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-xl text-white font-semibold transition-all duration-300 disabled:opacity-50"
        >
          {calculating ? 'Calculating...' : 'Calculate Correlations'}
        </button>
      </div>

      {error && (
        <div className="backdrop-blur-xl bg-red-500/20 border border-red-500/30 rounded-xl p-4 mb-6">
          <p className="text-white font-medium">❌ Error: {error}</p>
        </div>
      )}

      {correlations && correlations.length > 0 ? (
        <div className="relative">
          {/* Dark vertical timeline line */}
          <div className="absolute left-8 sm:left-12 top-0 bottom-0 w-1 bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700 shadow-lg" />

          {correlations.map((corr, idx) => (
            <div key={corr.id} className="relative pl-20 sm:pl-28 pb-8 sm:pb-12">
              {/* Timeline dot with color based on strength */}
              <div
                className={`absolute left-5 sm:left-9 top-8 w-7 h-7 rounded-full border-4 transition-all shadow-xl ${
                  Math.abs(corr.coefficient) >= 0.6
                    ? 'bg-green-500 border-green-400'
                    : Math.abs(corr.coefficient) >= 0.3
                    ? 'bg-yellow-500 border-yellow-400'
                    : 'bg-slate-600 border-slate-500'
                }`}
              />

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="backdrop-blur-xl bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 sm:p-6 shadow-2xl"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {corr.metricA} ↔ {corr.metricB}
                    </h3>
                    <p className="text-sm text-white/60">
                      {getCorrelationStrength(corr.coefficient)} correlation
                    </p>
                  </div>
                  <div className={`
                    px-4 py-2 rounded-lg font-bold text-lg
                    ${Math.abs(corr.coefficient) >= 0.6
                      ? 'bg-green-500/20 text-green-300'
                      : Math.abs(corr.coefficient) >= 0.3
                      ? 'bg-yellow-500/20 text-yellow-300'
                      : 'bg-slate-600/20 text-slate-300'
                    }
                  `}>
                    {corr.coefficient >= 0 ? '+' : ''}{corr.coefficient.toFixed(3)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-white/70">
                  <div>
                    <span className="font-medium">Sample Size:</span> {corr.sampleSize}
                  </div>
                  <div>
                    <span className="font-medium">P-value:</span> {corr.pValue.toFixed(3)}
                  </div>
                  <div>
                    <span className="font-medium">Significance:</span>{' '}
                    {corr.pValue < 0.05 ? '✓ Significant' : '○ Not significant'}
                  </div>
                </div>
              </motion.div>
            </div>
          ))}
        </div>
      ) : (
        <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-700/50 rounded-2xl p-12 text-center">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-2xl font-bold text-white mb-2">
            No Correlations Yet
          </h3>
          <p className="text-white/70">
            Import health data and click "Calculate Correlations" to discover patterns
          </p>
        </div>
      )}
    </div>
  );
}
