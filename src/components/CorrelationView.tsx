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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">
            Correlation Analysis
          </h2>
          <p className="text-white/70">
            Discover relationships between your health metrics
          </p>
        </div>
        <button
          onClick={handleCalculate}
          disabled={calculating}
          className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-xl text-white font-semibold transition-all duration-300 hover:scale-105 disabled:opacity-50"
        >
          {calculating ? 'Calculating...' : 'Calculate Correlations'}
        </button>
      </div>

      {error && (
        <div className="backdrop-blur-xl bg-red-500/20 border border-red-500/30 rounded-xl p-4">
          <p className="text-white font-medium">❌ Error: {error}</p>
        </div>
      )}

      {correlations && correlations.length > 0 ? (
        <div className="grid gap-4">
          {correlations.map((corr, idx) => (
            <motion.div
              key={corr.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-xl p-6"
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
                    : 'bg-gray-500/20 text-gray-300'
                  }
                `}>
                  {corr.coefficient >= 0 ? '+' : ''}{corr.coefficient.toFixed(3)}
                </div>
              </div>

              <div className="flex gap-6 text-sm text-white/70">
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
          ))}
        </div>
      ) : (
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-12 text-center">
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
