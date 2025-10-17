// Phase 4: Financial ROI Timeline Component
// Multi-layer timeline visualization showing health metrics, supplements, spending, and ROI

import { useState } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

interface TimelineDataPoint {
  date: string;
  health_value?: number;
  spending?: number;
  roi?: number;
  supplements?: string[];
}

interface ROITimelineProps {
  data: TimelineDataPoint[];
  timeRange?: 'week' | 'month' | 'quarter' | 'year';
}

type LayerType = 'health' | 'spending' | 'roi' | 'supplements';

export default function ROITimeline({ data, timeRange = 'month' }: ROITimelineProps) {
  const [visibleLayers, setVisibleLayers] = useState<Set<LayerType>>(
    new Set(['health', 'spending', 'roi'])
  );
  const [focusedDate, setFocusedDate] = useState<string | null>(null);

  const toggleLayer = (layer: LayerType) => {
    const newLayers = new Set(visibleLayers);
    if (newLayers.has(layer)) {
      newLayers.delete(layer);
    } else {
      newLayers.add(layer);
    }
    setVisibleLayers(newLayers);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-white/20 rounded-lg p-4 shadow-xl">
          <p className="text-white font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-sm">
              <span style={{ color: entry.color }}>{entry.name}:</span>
              <span className="font-bold text-white">
                {entry.name.includes('$') || entry.name.includes('Spending') || entry.name.includes('ROI')
                  ? `$${entry.value.toFixed(2)}`
                  : entry.value.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white/5 rounded-xl border border-white/10">
        <div className="text-6xl mb-4">📈</div>
        <p className="text-gray-400">No timeline data available</p>
        <p className="text-sm text-gray-500 mt-2">Track health and spending to see the timeline</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">Health-Finance ROI Timeline</h3>
          <p className="text-sm text-gray-400 mt-1">Multi-layer visualization of health outcomes and spending</p>
        </div>

        {/* Layer Toggle Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => toggleLayer('health')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              visibleLayers.has('health')
                ? 'bg-green-500 text-white'
                : 'bg-white/10 text-gray-400 hover:bg-white/20'
            }`}
          >
            ❤️ Health
          </button>
          <button
            onClick={() => toggleLayer('spending')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              visibleLayers.has('spending')
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-gray-400 hover:bg-white/20'
            }`}
          >
            💰 Spending
          </button>
          <button
            onClick={() => toggleLayer('roi')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              visibleLayers.has('roi')
                ? 'bg-purple-500 text-white'
                : 'bg-white/10 text-gray-400 hover:bg-white/20'
            }`}
          >
            📊 ROI
          </button>
          <button
            onClick={() => toggleLayer('supplements')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              visibleLayers.has('supplements')
                ? 'bg-orange-500 text-white'
                : 'bg-white/10 text-gray-400 hover:bg-white/20'
            }`}
          >
            💊 Events
          </button>
        </div>
      </div>

      {/* Timeline Visualization */}
      <div className="bg-white/5 rounded-xl p-6 border border-white/10">
        {/* Health Metrics Layer */}
        {visibleLayers.has('health') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6"
          >
            <p className="text-sm font-medium text-green-400 mb-3">Health Trend</p>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="health_value"
                  name="Health Score"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Spending Layer */}
        {visibleLayers.has('spending') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6"
          >
            <p className="text-sm font-medium text-blue-400 mb-3">Spending Pattern</p>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="spending" name="Health Spending" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* ROI Layer */}
        {visibleLayers.has('roi') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6"
          >
            <p className="text-sm font-medium text-purple-400 mb-3">Return on Investment</p>
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="roiGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="roi"
                  name="ROI %"
                  stroke="#a855f7"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#roiGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Supplement Events Layer */}
        {visibleLayers.has('supplements') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <p className="text-sm font-medium text-orange-400 mb-3">Supplement Events</p>
            <div className="relative h-20 border border-white/10 rounded-lg p-2">
              <div className="absolute inset-0 flex items-center px-4">
                {data.map((point, index) => {
                  if (!point.supplements || point.supplements.length === 0) return null;
                  const position = (index / (data.length - 1)) * 100;
                  return (
                    <div
                      key={index}
                      className="absolute"
                      style={{ left: `${position}%` }}
                      onMouseEnter={() => setFocusedDate(point.date)}
                      onMouseLeave={() => setFocusedDate(null)}
                    >
                      <div className="relative">
                        <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
                        {focusedDate === point.date && (
                          <div className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 bg-gray-900 border border-white/20 rounded-lg p-2 whitespace-nowrap text-xs">
                            <p className="font-semibold text-white mb-1">{point.date}</p>
                            {point.supplements.map((supp, i) => (
                              <p key={i} className="text-gray-300">• {supp}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-lg p-4 border border-green-500/30">
          <p className="text-sm text-green-300">Avg Health Score</p>
          <p className="text-2xl font-bold text-white">
            {(data.reduce((sum, d) => sum + (d.health_value || 0), 0) / data.length).toFixed(1)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-lg p-4 border border-blue-500/30">
          <p className="text-sm text-blue-300">Total Spending</p>
          <p className="text-2xl font-bold text-white">
            ${data.reduce((sum, d) => sum + (d.spending || 0), 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-lg p-4 border border-purple-500/30">
          <p className="text-sm text-purple-300">Avg ROI</p>
          <p className="text-2xl font-bold text-white">
            {(data.reduce((sum, d) => sum + (d.roi || 0), 0) / data.length).toFixed(0)}%
          </p>
        </div>
      </div>
    </div>
  );
}
