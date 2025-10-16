import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase, type HealthDataPoint, type HealthMetricType } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface TimelineEntry {
  timestamp: string;
  metrics: HealthDataPoint[];
}

export function HealthTimeline() {
  const [loading, setLoading] = useState(true);
  const [healthData, setHealthData] = useState<HealthDataPoint[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<HealthMetricType | 'all'>('all');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  useEffect(() => {
    loadHealthData();
  }, [selectedMetric, timeRange]);

  const loadHealthData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Calculate time range
      const now = new Date();
      const startTime = new Date(now);
      if (timeRange === '24h') {
        startTime.setHours(startTime.getHours() - 24);
      } else if (timeRange === '7d') {
        startTime.setDate(startTime.getDate() - 7);
      } else {
        startTime.setDate(startTime.getDate() - 30);
      }

      // Query health data
      let query = supabase
        .from('health_data_points')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', startTime.toISOString())
        .lte('timestamp', now.toISOString())
        .order('timestamp', { ascending: false })
        .limit(1000);

      // Filter by metric type if not 'all'
      if (selectedMetric !== 'all') {
        query = query.eq('type', selectedMetric);
      }

      const { data, error } = await query;

      if (error) throw error;
      setHealthData(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading health data');
      setLoading(false);
    }
  };

  // Group data by time buckets for timeline display
  const groupDataByTime = (): TimelineEntry[] => {
    if (healthData.length === 0) return [];

    const bucketSize = timeRange === '24h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 1 hour or 1 day
    const buckets = new Map<number, HealthDataPoint[]>();

    healthData.forEach(point => {
      const timestamp = new Date(point.timestamp).getTime();
      const bucketKey = Math.floor(timestamp / bucketSize) * bucketSize;

      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }
      buckets.get(bucketKey)!.push(point);
    });

    return Array.from(buckets.entries())
      .map(([timestamp, metrics]) => ({
        timestamp: new Date(timestamp).toISOString(),
        metrics
      }))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const getMetricColor = (type: HealthMetricType): string => {
    const colors: Record<HealthMetricType, string> = {
      heart_rate: 'text-red-400',
      blood_oxygen: 'text-blue-400',
      respiratory_rate: 'text-cyan-400',
      body_temperature: 'text-orange-400',
      steps: 'text-green-400',
      distance: 'text-emerald-400',
      calories: 'text-yellow-400',
      exercise: 'text-purple-400',
      sleep_stage: 'text-indigo-400',
      nutrition: 'text-pink-400',
      hydration: 'text-teal-400',
      stress_level: 'text-violet-400'
    };
    return colors[type] || 'text-white';
  };

  const getMetricIcon = (type: HealthMetricType): string => {
    const icons: Record<HealthMetricType, string> = {
      heart_rate: '❤️',
      blood_oxygen: '🫁',
      respiratory_rate: '🌬️',
      body_temperature: '🌡️',
      steps: '👣',
      distance: '📏',
      calories: '🔥',
      exercise: '💪',
      sleep_stage: '😴',
      nutrition: '🍎',
      hydration: '💧',
      stress_level: '🧘'
    };
    return icons[type] || '📊';
  };

  const formatMetricValue = (point: HealthDataPoint): string => {
    const units: Record<HealthMetricType, string> = {
      heart_rate: 'bpm',
      blood_oxygen: '%',
      respiratory_rate: 'br/min',
      body_temperature: '°F',
      steps: 'steps',
      distance: 'm',
      calories: 'cal',
      exercise: 'min',
      sleep_stage: '',
      nutrition: 'cal',
      hydration: 'ml',
      stress_level: ''
    };
    return `${point.value.toFixed(1)} ${units[point.type]}`;
  };

  const timelineEntries = groupDataByTime();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Loading health timeline...</div>
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
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Health Timeline</h2>
        <p className="text-white/60">
          {healthData.length} data points across {timelineEntries.length} time periods
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4">
        {/* Time Range Selector */}
        <div className="flex gap-2">
          {(['24h', '7d', '30d'] as const).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                timeRange === range
                  ? 'bg-violet-500/30 border-2 border-violet-400/50 text-white'
                  : 'bg-white/5 border-2 border-white/10 text-white/60 hover:bg-white/10'
              }`}
            >
              {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : '30 Days'}
            </button>
          ))}
        </div>

        {/* Metric Type Selector */}
        <select
          value={selectedMetric}
          onChange={(e) => setSelectedMetric(e.target.value as HealthMetricType | 'all')}
          className="px-4 py-2 rounded-xl bg-white/5 border-2 border-white/10 text-white font-medium"
        >
          <option value="all">All Metrics</option>
          <option value="heart_rate">Heart Rate</option>
          <option value="blood_oxygen">Blood Oxygen</option>
          <option value="steps">Steps</option>
          <option value="sleep_stage">Sleep</option>
          <option value="calories">Calories</option>
          <option value="nutrition">Nutrition</option>
          <option value="hydration">Hydration</option>
          <option value="stress_level">Stress</option>
        </select>
      </div>

      {/* Timeline */}
      {timelineEntries.length === 0 ? (
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 text-center">
          <div className="text-5xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Health Data</h3>
          <p className="text-white/60 mb-4">
            No health data found for the selected time range and metric.
          </p>
          <p className="text-sm text-white/40">
            Data will appear here once you sync from the Android HealthBridge app.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {timelineEntries.map((entry, idx) => (
            <motion.div
              key={entry.timestamp}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
            >
              {/* Time Header */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10">
                <div className="text-2xl">📅</div>
                <div>
                  <div className="text-lg font-semibold text-white">
                    {new Date(entry.timestamp).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-white/60">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <div className="ml-auto text-white/40 text-sm">
                  {entry.metrics.length} readings
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {entry.metrics.map((point, pointIdx) => (
                  <div
                    key={`${point.id}-${pointIdx}`}
                    className="bg-white/5 rounded-xl p-4 border border-white/5"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{getMetricIcon(point.type)}</span>
                      <span className="text-sm text-white/60 capitalize">
                        {point.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className={`text-2xl font-bold ${getMetricColor(point.type)}`}>
                      {formatMetricValue(point)}
                    </div>
                    {point.accuracy && (
                      <div className="text-xs text-white/40 mt-1">
                        {point.accuracy}% accuracy
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Data Summary */}
      {healthData.length > 0 && (
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 backdrop-blur-xl rounded-2xl border border-indigo-500/20 p-6">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <span>📊</span>
            <span>Data Summary</span>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-white/60">Total Points</div>
              <div className="text-xl font-bold text-white">{healthData.length}</div>
            </div>
            <div>
              <div className="text-white/60">Time Periods</div>
              <div className="text-xl font-bold text-white">{timelineEntries.length}</div>
            </div>
            <div>
              <div className="text-white/60">Avg Accuracy</div>
              <div className="text-xl font-bold text-white">
                {(healthData.reduce((sum, p) => sum + (p.accuracy || 0), 0) / healthData.length).toFixed(0)}%
              </div>
            </div>
            <div>
              <div className="text-white/60">Data Sources</div>
              <div className="text-xl font-bold text-white">
                {new Set(healthData.map(p => p.source)).size}
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
