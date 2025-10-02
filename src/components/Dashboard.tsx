import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { SupplementsView } from './SupplementsView';
import { MetricChart } from './MetricChart';
import { CorrelationView } from './CorrelationView';
import { useHealthMetrics, useLatestMetrics } from '../hooks/useHealthData';
import { fetchAndSyncHealthData } from '../services/autoSync';
import { clearAuth, getUserId } from '../lib/auth';
import { startBackgroundSync, stopBackgroundSync } from '../services/syncService';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'supplements' | 'correlations'>('overview');
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

  // Auto-sync on mount and start background sync
  useEffect(() => {
    let timer: any;

    const sync = async () => {
      setSyncStatus('syncing');
      try {
        const result = await fetchAndSyncHealthData();
        setSyncStatus(result.success ? 'success' : 'error');
      } catch (error) {
        console.error('Sync error:', error);
        setSyncStatus('error');
      }

      // Reset status after 3 seconds
      timer = setTimeout(() => setSyncStatus('idle'), 3000);
    };

    sync();
    startBackgroundSync();

    return () => {
      if (timer) clearTimeout(timer);
      stopBackgroundSync();
    };
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour >= 5 && hour < 12 ? 'Good Morning' :
    hour >= 12 && hour < 17 ? 'Good Afternoon' :
    hour >= 17 && hour < 21 ? 'Good Evening' : 'Good Night';

  const handleLogout = () => {
    clearAuth();
    window.location.reload();
  };

  return (
    <div className="min-h-screen relative">
      <div className="relative z-10 min-h-screen">
        {/* Header */}
        <header className="p-4 sm:p-6">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <h1 className="text-2xl sm:text-3xl font-bold text-white drop-shadow-lg">
                HealthHub
              </h1>
              {syncStatus === 'syncing' && (
                <span className="text-xs sm:text-sm text-white/70">Syncing...</span>
              )}
              {syncStatus === 'success' && (
                <span className="text-xs sm:text-sm text-green-300">✓ Synced</span>
              )}
              {syncStatus === 'error' && (
                <span className="text-xs sm:text-sm text-red-300">Sync failed</span>
              )}
              {!navigator.onLine && (
                <span className="text-xs sm:text-sm text-yellow-300">⚠ Offline</span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
              <nav className="flex gap-2 overflow-x-auto">
                {(['overview', 'supplements', 'correlations'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`
                      px-4 sm:px-6 py-2 rounded-xl font-medium transition-all duration-300 whitespace-nowrap text-sm sm:text-base
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
              <button
                onClick={handleLogout}
                className="px-4 sm:px-6 py-2 rounded-xl font-medium transition-all duration-300 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm sm:text-base"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'overview' && (
              <OverviewTimeline
                latestMetrics={latestMetrics}
                heartRateAvgData={heartRateAvgData}
                heartRateMinData={heartRateMinData}
                heartRateMaxData={heartRateMaxData}
                restingHRData={restingHRData}
                hrvData={hrvData}
                oxygenData={oxygenData}
                respiratoryData={respiratoryData}
                stepsData={stepsData}
                sleepData={sleepData}
                weightData={weightData}
                bodyFatData={bodyFatData}
                activeCaloriesData={activeCaloriesData}
                totalCaloriesData={totalCaloriesData}
              />
            )}

            {activeTab === 'supplements' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <SupplementsView />
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

function OverviewTimeline({ latestMetrics, ...allData }: any) {
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'hourly' | 'daily' | 'weekly'>('daily');

  const metrics = [
    { key: 'steps', title: 'Steps', value: latestMetrics?.steps?.value.toFixed(0), unit: 'steps', data: allData.stepsData, color: '#F59E0B' },
    { key: 'sleep_duration', title: 'Sleep', value: latestMetrics?.sleep_duration?.value.toFixed(1), unit: 'hrs', data: allData.sleepData, color: '#8B5CF6' },
    { key: 'heart_rate_avg', title: 'Heart Rate', value: latestMetrics?.heart_rate_avg?.value.toFixed(0), unit: 'bpm', data: allData.heartRateAvgData, color: '#EF4444' },
    { key: 'hrv_rmssd', title: 'HRV', value: latestMetrics?.hrv_rmssd?.value.toFixed(0), unit: 'ms', data: allData.hrvData, color: '#14B8A6' },
    { key: 'resting_heart_rate', title: 'Resting HR', value: latestMetrics?.resting_heart_rate?.value.toFixed(0), unit: 'bpm', data: allData.restingHRData, color: '#DC2626' },
    { key: 'oxygen_saturation', title: 'SpO₂', value: latestMetrics?.oxygen_saturation?.value.toFixed(1), unit: '%', data: allData.oxygenData, color: '#06B6D4' },
    { key: 'respiratory_rate', title: 'Resp Rate', value: latestMetrics?.respiratory_rate?.value.toFixed(0), unit: 'brpm', data: allData.respiratoryData, color: '#0EA5E9' },
    { key: 'weight', title: 'Weight', value: latestMetrics?.weight?.value.toFixed(1), unit: 'kg', data: allData.weightData, color: '#EC4899' },
    { key: 'body_fat', title: 'Body Fat', value: latestMetrics?.body_fat?.value.toFixed(1), unit: '%', data: allData.bodyFatData, color: '#D946EF' },
    { key: 'active_calories', title: 'Active Cal', value: latestMetrics?.active_calories?.value.toFixed(0), unit: 'kcal', data: allData.activeCaloriesData, color: '#F97316' },
  ].filter(m => m.data && m.data.length > 0);

  if (metrics.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-2xl font-bold text-white mb-2">No Health Data Yet</h3>
        <p className="text-white/70">Export data from your Health Connect app to see metrics here</p>
      </div>
    );
  }

  return (
    <div className="relative max-w-4xl mx-auto">
      {/* Dark vertical timeline line */}
      <div className="absolute left-8 sm:left-12 top-0 bottom-0 w-1 bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700 shadow-lg" />

      {metrics.map((metric, idx) => {
        const isExpanded = expandedMetric === metric.key;
        return (
          <div key={metric.key} className="relative pl-20 sm:pl-28 pb-8 sm:pb-12">
            {/* Timeline dot */}
            <div className={`absolute left-5 sm:left-9 top-8 w-7 h-7 rounded-full border-4 transition-all shadow-xl bg-slate-700 border-slate-500`} style={{ borderColor: metric.color }} />

            <motion.div
              className="backdrop-blur-xl bg-slate-900/60 border border-slate-700/50 rounded-2xl p-4 sm:p-6 shadow-2xl cursor-pointer"
              onClick={() => setExpandedMetric(isExpanded ? null : metric.key)}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg sm:text-xl font-semibold text-white mb-1">{metric.title}</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-bold text-white">{metric.value || '--'}</span>
                    <span className="text-white/70 text-lg">{metric.unit}</span>
                  </div>
                </div>
                <button className="text-white/70 hover:text-white transition-colors">
                  {isExpanded ? '▼' : '▶'}
                </button>
              </div>

              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 pt-4 border-t border-slate-700"
                >
                  <div className="flex gap-2 mb-4">
                    {(['hourly', 'daily', 'weekly'] as const).map(range => (
                      <button
                        key={range}
                        onClick={(e) => { e.stopPropagation(); setTimeRange(range); }}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          timeRange === range ? 'bg-slate-700 text-white' : 'bg-slate-800/50 text-white/60 hover:text-white'
                        }`}
                      >
                        {range.charAt(0).toUpperCase() + range.slice(1)}
                      </button>
                    ))}
                  </div>
                  <MetricChart data={metric.data} title={`${metric.title} (${timeRange})`} unit={metric.unit} color={metric.color} />
                </motion.div>
              )}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
