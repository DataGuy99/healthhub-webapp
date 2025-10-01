import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FluidBackground } from './FluidBackground';
import { ImportData } from './ImportData';
import { MetricChart } from './MetricChart';
import { CorrelationView } from './CorrelationView';
import { useHealthMetrics, useLatestMetrics } from '../hooks/useHealthData';
import { fetchAndSyncHealthData } from '../services/autoSync';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'import' | 'correlations'>('overview');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const latestMetrics = useLatestMetrics();

  // Fetch all 15 metrics
  const heartRateAvgData = useHealthMetrics('heart_rate_avg', 7);
  const heartRateMinData = useHealthMetrics('heart_rate_min', 7);
  const heartRateMaxData = useHealthMetrics('heart_rate_max', 7);
  const restingHRData = useHealthMetrics('resting_heart_rate', 7);
  const hrvData = useHealthMetrics('hrv_rmssd', 7);
  const oxygenData = useHealthMetrics('oxygen_saturation', 7);
  const respiratoryData = useHealthMetrics('respiratory_rate', 7);
  const stepsData = useHealthMetrics('steps', 7);
  const sleepData = useHealthMetrics('sleep_duration', 7);
  const weightData = useHealthMetrics('weight', 7);
  const bodyFatData = useHealthMetrics('body_fat', 7);
  const activeCaloriesData = useHealthMetrics('active_calories', 7);
  const totalCaloriesData = useHealthMetrics('total_calories', 7);

  // Auto-sync on mount
  useEffect(() => {
    let timer: any;

    const sync = async () => {
      setSyncStatus('syncing');
      const result = await fetchAndSyncHealthData();
      setSyncStatus(result.success ? 'success' : 'error');

      // Reset status after 3 seconds
      timer = setTimeout(() => setSyncStatus('idle'), 3000);
    };

    sync();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour >= 5 && hour < 12 ? 'Good Morning' :
    hour >= 12 && hour < 17 ? 'Good Afternoon' :
    hour >= 17 && hour < 21 ? 'Good Evening' : 'Good Night';

  return (
    <div className="min-h-screen relative">
      <FluidBackground />

      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <header className="p-6">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-white drop-shadow-lg">
                HealthHub
              </h1>
              {syncStatus === 'syncing' && (
                <span className="text-sm text-white/70">Syncing...</span>
              )}
              {syncStatus === 'success' && (
                <span className="text-sm text-green-300">✓ Synced</span>
              )}
              {syncStatus === 'error' && (
                <span className="text-sm text-red-300">Sync failed</span>
              )}
            </div>
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
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                  <StatCard
                    title="Steps"
                    value={latestMetrics?.steps?.value.toFixed(0) || '--'}
                    unit="steps"
                  />
                  <StatCard
                    title="Sleep"
                    value={latestMetrics?.sleep_duration?.value.toFixed(1) || '--'}
                    unit="hrs"
                  />
                  <StatCard
                    title="Heart Rate"
                    value={latestMetrics?.heart_rate_avg?.value.toFixed(0) || '--'}
                    unit="bpm"
                  />
                  <StatCard
                    title="HRV"
                    value={latestMetrics?.hrv_rmssd?.value.toFixed(0) || '--'}
                    unit="ms"
                  />
                  <StatCard
                    title="Resting HR"
                    value={latestMetrics?.resting_heart_rate?.value.toFixed(0) || '--'}
                    unit="bpm"
                  />
                  <StatCard
                    title="SpO₂"
                    value={latestMetrics?.oxygen_saturation?.value.toFixed(1) || '--'}
                    unit="%"
                  />
                  <StatCard
                    title="Resp Rate"
                    value={latestMetrics?.respiratory_rate?.value.toFixed(0) || '--'}
                    unit="brpm"
                  />
                  <StatCard
                    title="Weight"
                    value={latestMetrics?.weight?.value.toFixed(1) || '--'}
                    unit="kg"
                  />
                  <StatCard
                    title="Body Fat"
                    value={latestMetrics?.body_fat?.value.toFixed(1) || '--'}
                    unit="%"
                  />
                  <StatCard
                    title="Active Cal"
                    value={latestMetrics?.active_calories?.value.toFixed(0) || '--'}
                    unit="kcal"
                  />
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {stepsData && stepsData.length > 0 && (
                    <MetricChart
                      data={stepsData}
                      title="Steps (7 days)"
                      unit="steps"
                      color="#F59E0B"
                    />
                  )}
                  {sleepData && sleepData.length > 0 && (
                    <MetricChart
                      data={sleepData}
                      title="Sleep Duration (7 days)"
                      unit="hours"
                      color="#8B5CF6"
                    />
                  )}
                  {heartRateAvgData && heartRateAvgData.length > 0 && (
                    <MetricChart
                      data={heartRateAvgData}
                      title="Avg Heart Rate (7 days)"
                      unit="bpm"
                      color="#EF4444"
                    />
                  )}
                  {restingHRData && restingHRData.length > 0 && (
                    <MetricChart
                      data={restingHRData}
                      title="Resting Heart Rate (7 days)"
                      unit="bpm"
                      color="#DC2626"
                    />
                  )}
                  {hrvData && hrvData.length > 0 && (
                    <MetricChart
                      data={hrvData}
                      title="HRV RMSSD (7 days)"
                      unit="ms"
                      color="#14B8A6"
                    />
                  )}
                  {oxygenData && oxygenData.length > 0 && (
                    <MetricChart
                      data={oxygenData}
                      title="Oxygen Saturation (7 days)"
                      unit="%"
                      color="#06B6D4"
                    />
                  )}
                  {respiratoryData && respiratoryData.length > 0 && (
                    <MetricChart
                      data={respiratoryData}
                      title="Respiratory Rate (7 days)"
                      unit="brpm"
                      color="#0EA5E9"
                    />
                  )}
                  {weightData && weightData.length > 0 && (
                    <MetricChart
                      data={weightData}
                      title="Weight (7 days)"
                      unit="kg"
                      color="#EC4899"
                    />
                  )}
                  {bodyFatData && bodyFatData.length > 0 && (
                    <MetricChart
                      data={bodyFatData}
                      title="Body Fat (7 days)"
                      unit="%"
                      color="#D946EF"
                    />
                  )}
                  {activeCaloriesData && activeCaloriesData.length > 0 && (
                    <MetricChart
                      data={activeCaloriesData}
                      title="Active Calories (7 days)"
                      unit="kcal"
                      color="#F97316"
                    />
                  )}
                  {totalCaloriesData && totalCaloriesData.length > 0 && (
                    <MetricChart
                      data={totalCaloriesData}
                      title="Total Calories (7 days)"
                      unit="kcal"
                      color="#FB923C"
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
