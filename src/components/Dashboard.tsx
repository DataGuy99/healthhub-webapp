import { useState } from 'react';
import { motion } from 'framer-motion';
import { LiquidGradientBackground } from './LiquidGradient';
import { ImportData } from './ImportData';
import { MetricChart } from './MetricChart';
import { CorrelationView } from './CorrelationView';
import { useHealthMetrics, useLatestMetrics } from '../hooks/useHealthData';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'import' | 'correlations'>('overview');
  const latestMetrics = useLatestMetrics();
  const heartRateData = useHealthMetrics('HEART_RATE', 7);
  const hrvData = useHealthMetrics('HEART_RATE_VARIABILITY', 7);
  const stepsData = useHealthMetrics('STEPS', 7);

  const hour = new Date().getHours();
  const greeting =
    hour >= 5 && hour < 12 ? 'Good Morning' :
    hour >= 12 && hour < 17 ? 'Good Afternoon' :
    hour >= 17 && hour < 21 ? 'Good Evening' : 'Good Night';

  return (
    <div className="min-h-screen relative">
      <LiquidGradientBackground />

      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <header className="p-6">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">
              HealthHub
            </h1>
            <nav className="flex gap-4">
              {(['overview', 'import', 'correlations'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    px-6 py-2 rounded-xl font-medium transition-all duration-300
                    ${activeTab === tab
                      ? 'bg-white/30 backdrop-blur-xl border border-white/40 text-white shadow-lg'
                      : 'bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 hover:bg-white/20'
                    }
                  `}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'overview' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                {/* Greeting */}
                <div className="text-center mb-12">
                  <h2 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">
                    {greeting}
                  </h2>
                  <p className="text-xl text-white/80">
                    Your health journey today
                  </p>
                </div>

                {/* Latest Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <StatCard
                    title="Heart Rate"
                    value={latestMetrics?.HEART_RATE?.value.toFixed(0) || '--'}
                    unit="bpm"
                  />
                  <StatCard
                    title="HRV"
                    value={latestMetrics?.HEART_RATE_VARIABILITY?.value.toFixed(0) || '--'}
                    unit="ms"
                  />
                  <StatCard
                    title="Steps"
                    value={latestMetrics?.STEPS?.value.toFixed(0) || '--'}
                    unit="steps"
                  />
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {heartRateData && heartRateData.length > 0 && (
                    <MetricChart
                      data={heartRateData}
                      title="Heart Rate (7 days)"
                      unit="bpm"
                      color="#EF4444"
                    />
                  )}
                  {hrvData && hrvData.length > 0 && (
                    <MetricChart
                      data={hrvData}
                      title="HRV (7 days)"
                      unit="ms"
                      color="#14B8A6"
                    />
                  )}
                  {stepsData && stepsData.length > 0 && (
                    <MetricChart
                      data={stepsData}
                      title="Steps (7 days)"
                      unit="steps"
                      color="#F59E0B"
                    />
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'import' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-12"
              >
                <ImportData />
              </motion.div>
            )}

            {activeTab === 'correlations' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <CorrelationView />
              </motion.div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({ title, value, unit }: { title: string; value: string; unit: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl p-6 shadow-xl"
    >
      <div className="text-white/70 text-sm font-medium mb-2">{title}</div>
      <div className="flex items-baseline gap-2">
        <div className="text-4xl font-bold text-white">{value}</div>
        <div className="text-white/70 text-lg">{unit}</div>
      </div>
    </motion.div>
  );
}
