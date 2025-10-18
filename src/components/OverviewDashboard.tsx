// Phase 4: Powerful Overview Dashboard
// Dynamic charts, real-time insights, and comprehensive financial + health visualization

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface OverviewDashboardProps {
  onCategorySelect: (category: string) => void;
}

interface CategorySpending {
  name: string;
  value: number;
  color: string;
  icon: string;
}

interface TrendDataPoint {
  date: string;
  spending: number;
  health: number;
  supplements: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  grocery: '#10b981',
  supplements: '#a855f7',
  auto: '#ef4444',
  bills: '#f59e0b',
  'misc-shop': '#ec4899',
  'misc-health': '#14b8a6',
  rent: '#3b82f6',
  // Phase 6.2: Removed investment and home-garden colors
};

const CATEGORY_ICONS: Record<string, string> = {
  grocery: '🛒',
  supplements: '💊',
  auto: '🚗',
  bills: '💡',
  'misc-shop': '🛍️',
  'misc-health': '🏥',
  rent: '🏠',
  // Phase 6.2: Removed investment and home-garden icons
};

export function OverviewDashboard({ onCategorySelect }: OverviewDashboardProps) {
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalBudget, setTotalBudget] = useState(0);
  const [healthScore, setHealthScore] = useState(0);
  const [supplementCount, setSupplementCount] = useState(0);
  const [topInsights, setTopInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgMPG, setAvgMPG] = useState(0);
  const [currentMileage, setCurrentMileage] = useState(0);
  const [showMPGPopup, setShowMPGPopup] = useState(false);
  const [popupMileage, setPopupMileage] = useState('');
  const [popupCost, setPopupCost] = useState('');
  const [popupGallons, setPopupGallons] = useState('');
  const [popupPricePerGallon, setPopupPricePerGallon] = useState('');

  useEffect(() => {
    loadOverviewData();
  }, []);

  const loadOverviewData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const currentMonth = new Date().toISOString().slice(0, 7);
      const startDate = `${currentMonth}-01`;
      const endDate = `${currentMonth}-31`;

      // Load category spending
      const { data: logsData } = await supabase
        .from('category_logs')
        .select('*, category_items!inner(category)')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      const spendingMap = new Map<string, number>();
      logsData?.forEach((log: any) => {
        const category = log.category_items?.category;
        if (category) {
          const current = spendingMap.get(category) || 0;
          spendingMap.set(category, current + (log.actual_amount || 0));
        }
      });

      const spending: CategorySpending[] = Array.from(spendingMap.entries()).map(([name, value]) => ({
        name,
        value,
        color: CATEGORY_COLORS[name] || '#6b7280',
        icon: CATEGORY_ICONS[name] || '📁',
      }));

      setCategorySpending(spending);
      setTotalSpent(spending.reduce((sum, cat) => sum + cat.value, 0));

      // Load budgets
      const { data: budgetsData } = await supabase
        .from('category_budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', currentMonth);

      const total = budgetsData?.reduce((sum, b) => sum + b.target_amount, 0) || 0;
      setTotalBudget(total);

      // Load trend data (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().slice(0, 10);
      });

      const trendPromises = last7Days.map(async (date) => {
        const { data: dayLogs } = await supabase
          .from('category_logs')
          .select('actual_amount')
          .eq('user_id', user.id)
          .eq('date', date);

        const { data: daySupps } = await supabase
          .from('supplement_logs')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', date)
          .eq('is_taken', true);

        const { data: healthData } = await supabase
          .from('health_data_points')
          .select('value')
          .eq('user_id', user.id)
          .gte('timestamp', `${date}T00:00:00`)
          .lte('timestamp', `${date}T23:59:59`)
          .eq('type', 'heart_rate');

        const spending = dayLogs?.reduce((sum, l) => sum + (l.actual_amount || 0), 0) || 0;
        const supplements = daySupps?.length || 0;
        const health = healthData?.length > 0
          ? healthData.reduce((sum, d) => sum + d.value, 0) / healthData.length
          : 0;

        return {
          date: date.slice(5),
          spending,
          health,
          supplements,
        };
      });

      const trends = await Promise.all(trendPromises);
      setTrendData(trends);

      // Load health score (average heart rate or other metric)
      const { data: recentHealth } = await supabase
        .from('health_data_points')
        .select('value')
        .eq('user_id', user.id)
        .eq('type', 'heart_rate')
        .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .limit(100);

      if (recentHealth && recentHealth.length > 0) {
        const avgHR = recentHealth.reduce((sum, d) => sum + d.value, 0) / recentHealth.length;
        setHealthScore(Math.round(avgHR));
      }

      // Load supplement count
      const { data: supps } = await supabase
        .from('supplements')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setSupplementCount(supps?.length || 0);

      // Load MPG data
      const { data: fillups } = await supabase
        .from('gas_fillups')
        .select('mileage, mpg')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(10);

      if (fillups && fillups.length > 0) {
        setCurrentMileage(Number(fillups[0].mileage) || 0);
        const mpgValues = fillups.filter(f => f.mpg !== null).map(f => Number(f.mpg));
        if (mpgValues.length > 0) {
          const avgMpg = mpgValues.reduce((sum, mpg) => sum + mpg, 0) / mpgValues.length;
          setAvgMPG(avgMpg);
        }
      }

      // Generate insights
      const insights: string[] = [];
      const budgetUsagePercent = total > 0 ? (totalSpent / total) * 100 : 0;

      if (budgetUsagePercent > 90) {
        insights.push('⚠️ You\'ve used over 90% of your monthly budget');
      } else if (budgetUsagePercent < 50) {
        insights.push('✅ You\'re well under budget this month');
      }

      const topCategory = spending.reduce((max, cat) => cat.value > max.value ? cat : max, spending[0]);
      if (topCategory) {
        insights.push(`💰 ${topCategory.name} is your biggest expense this month`);
      }

      if (supplementCount > 10) {
        insights.push(`💊 You're tracking ${supplementCount} supplements - consider ROI analysis`);
      }

      if (recentHealth && recentHealth.length > 50) {
        insights.push(`❤️ Strong health data collection - ${recentHealth.length} data points this week`);
      }

      setTopInsights(insights.slice(0, 3));
      setLoading(false);
    } catch (error) {
      console.error('Error loading overview:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Loading overview...</div>
      </div>
    );
  }

  const budgetRemaining = Math.max(totalBudget - totalSpent, 0);
  const budgetUsagePercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const logMPGFillup = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      if (!popupMileage || !popupCost || !popupGallons) {
        alert('Please fill in all fields');
        return;
      }

      const mileage = parseInt(popupMileage);
      const cost = parseFloat(popupCost);
      const gallons = parseFloat(popupGallons);
      const pricePerGallon = popupPricePerGallon ? parseFloat(popupPricePerGallon) : cost / gallons;

      const { error } = await supabase
        .from('gas_fillups')
        .insert({
          user_id: user.id,
          date: new Date().toISOString().split('T')[0],
          mileage,
          gallons,
          cost,
          price_per_gallon: pricePerGallon,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      setShowMPGPopup(false);
      setPopupMileage('');
      setPopupCost('');
      setPopupGallons('');
      setPopupPricePerGallon('');
      loadOverviewData();
    } catch (error) {
      console.error('Error logging fillup:', error);
      alert('Failed to log fillup');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-xl rounded-2xl border border-purple-500/30 p-6"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-4xl">💰</div>
            <div className={`text-xs px-2 py-1 rounded-full ${
              budgetUsagePercent > 90 ? 'bg-red-500/20 text-red-300' :
              budgetUsagePercent > 75 ? 'bg-yellow-500/20 text-yellow-300' :
              'bg-green-500/20 text-green-300'
            }`}>
              {budgetUsagePercent.toFixed(0)}%
            </div>
          </div>
          <h3 className="text-white/60 text-sm font-medium mb-1">Total Spent</h3>
          <p className="text-3xl font-bold text-white">${totalSpent.toFixed(2)}</p>
          <p className="text-xs text-white/40 mt-2">of ${totalBudget.toFixed(2)} budget</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-xl rounded-2xl border border-green-500/30 p-6"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-4xl">✅</div>
            <div className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-300">
              {totalBudget > 0 ? ((budgetRemaining / totalBudget) * 100).toFixed(0) : 0}%
            </div>
          </div>
          <h3 className="text-white/60 text-sm font-medium mb-1">Remaining</h3>
          <p className="text-3xl font-bold text-green-400">${budgetRemaining.toFixed(2)}</p>
          <p className="text-xs text-white/40 mt-2">left to spend</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-red-500/20 to-pink-500/20 backdrop-blur-xl rounded-2xl border border-red-500/30 p-6"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-4xl">❤️</div>
            <div className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-300">
              {healthScore > 0 ? 'Active' : 'N/A'}
            </div>
          </div>
          <h3 className="text-white/60 text-sm font-medium mb-1">Health</h3>
          <p className="text-3xl font-bold text-white">{healthScore > 0 ? `${healthScore} bpm` : '--'}</p>
          <p className="text-xs text-white/40 mt-2">avg heart rate</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gradient-to-br from-violet-500/20 to-purple-500/20 backdrop-blur-xl rounded-2xl border border-violet-500/30 p-6"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-4xl">💊</div>
            <div className="text-xs px-2 py-1 rounded-full bg-violet-500/20 text-violet-300">
              Active
            </div>
          </div>
          <h3 className="text-white/60 text-sm font-medium mb-1">Supplements</h3>
          <p className="text-3xl font-bold text-white">{supplementCount}</p>
          <p className="text-xs text-white/40 mt-2">in library</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          onClick={() => setShowMPGPopup(true)}
          className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-xl rounded-2xl border border-blue-500/30 p-6 cursor-pointer"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-4xl">🚗</div>
            <div className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">
              {currentMileage > 0 ? `${currentMileage.toLocaleString()} mi` : 'N/A'}
            </div>
          </div>
          <h3 className="text-white/60 text-sm font-medium mb-1">Avg MPG</h3>
          <p className="text-3xl font-bold text-white">{avgMPG > 0 ? avgMPG.toFixed(1) : '--'}</p>
          <p className="text-xs text-white/40 mt-2">click to log fillup</p>
        </motion.div>
      </div>

      {/* MPG Popup Form */}
      {showMPGPopup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-blue-500/30 p-6 max-w-md w-full"
          >
            <h3 className="text-2xl font-bold text-white mb-4">⛽ Log Fillup</h3>

            <div className="space-y-4">
              <div>
                <label className="text-white/70 text-sm">Cost & Gallons</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={popupCost}
                    onChange={(e) => setPopupCost(e.target.value)}
                    className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                    placeholder="$45.00"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={popupGallons}
                    onChange={(e) => setPopupGallons(e.target.value)}
                    className="px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                    placeholder="12.5 gal"
                  />
                </div>
              </div>

              <div>
                <label className="text-white/70 text-sm">Price/Gallon (optional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={popupPricePerGallon}
                  onChange={(e) => setPopupPricePerGallon(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  placeholder="$3.60 (auto-calculated if empty)"
                />
              </div>

              <div>
                <label className="text-white/70 text-sm">Mileage</label>
                <input
                  type="number"
                  value={popupMileage}
                  onChange={(e) => setPopupMileage(e.target.value)}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  placeholder={currentMileage > 0 ? currentMileage.toString() : "12500"}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowMPGPopup(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={logMPGFillup}
                  className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500/20 to-cyan-500/20 hover:from-blue-500/30 hover:to-cyan-500/30 border border-blue-500/30 text-blue-300 font-medium transition-all"
                >
                  Log Fillup
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Insights */}
      {topInsights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-xl rounded-2xl border border-blue-500/30 p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4">🧠 Smart Insights</h3>
          <div className="space-y-2">
            {topInsights.map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 text-sm text-white/80"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                {insight}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending Breakdown (Pie Chart) */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-lg font-bold text-white mb-4">💰 Spending Breakdown</h3>
          {categorySpending.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categorySpending as any}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categorySpending.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-white/40">
              No spending data yet
            </div>
          )}
        </div>

        {/* 7-Day Trend (Area Chart) */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-lg font-bold text-white mb-4">📈 7-Day Trend</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="spending"
                  name="Spending"
                  stroke="#a855f7"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#spendingGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-white/40">
              No trend data yet
            </div>
          )}
        </div>
      </div>

      {/* Category Quick Actions */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <h3 className="text-lg font-bold text-white mb-4">🎯 Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {categorySpending.slice(0, 10).map((cat, i) => (
            <motion.button
              key={i}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onCategorySelect(cat.name)}
              className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl p-4 transition-all"
            >
              <div className="text-3xl mb-2">{cat.icon}</div>
              <div className="text-sm font-medium text-white">{cat.name}</div>
              <div className="text-xs text-white/60 mt-1">${cat.value.toFixed(0)}</div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Health + Finance Combined Chart */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <h3 className="text-lg font-bold text-white mb-4">🔥 Health-Finance Correlation</h3>
        {trendData.some(d => d.health > 0) ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="date" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
              <YAxis yAxisId="left" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
              <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="spending"
                name="Spending ($)"
                stroke="#a855f7"
                strokeWidth={2}
                dot={{ fill: '#a855f7', r: 4 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="health"
                name="Heart Rate (bpm)"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ fill: '#ef4444', r: 4 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="supplements"
                name="Supplements"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-[300px] text-white/40">
            <div className="text-5xl mb-3">❤️</div>
            <p>Connect health data to see correlations</p>
            <button
              onClick={() => onCategorySelect('health')}
              className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-300 transition-all"
            >
              Go to Health
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
