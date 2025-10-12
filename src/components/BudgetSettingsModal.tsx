import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, BudgetSettings } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface BudgetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function BudgetSettingsModal({ isOpen, onClose, onSave }: BudgetSettingsModalProps) {
  const [periodType, setPeriodType] = useState<'weekly' | 'biweekly' | 'monthly' | 'custom'>('weekly');
  const [startDay, setStartDay] = useState<number>(0); // Default Sunday
  const [monthlyStartDay, setMonthlyStartDay] = useState<number>(1); // Default 1st of month
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customLength, setCustomLength] = useState<number>(7);
  const [loading, setLoading] = useState(false);
  const [existingSettings, setExistingSettings] = useState<BudgetSettings | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('budget_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setExistingSettings(data);
        setPeriodType(data.period_type);
        if (data.period_start_day !== null && data.period_start_day !== undefined) {
          if (data.period_type === 'monthly') {
            setMonthlyStartDay(data.period_start_day);
          } else {
            setStartDay(data.period_start_day);
          }
        }
        if (data.period_start_date) {
          setCustomStartDate(data.period_start_date);
        }
        if (data.period_length_days) {
          setCustomLength(data.period_length_days);
        }
      }
    } catch (error) {
      console.error('Error loading budget settings:', error);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const user = await getCurrentUser();
      if (!user) return;

      const settings: Partial<BudgetSettings> = {
        user_id: user.id,
        period_type: periodType,
        period_start_day: periodType === 'monthly' ? monthlyStartDay : (periodType === 'weekly' || periodType === 'biweekly') ? startDay : null,
        period_start_date: periodType === 'custom' ? customStartDate : null,
        period_length_days: periodType === 'custom' ? customLength : null,
        updated_at: new Date().toISOString(),
      };

      if (existingSettings) {
        const { error } = await supabase
          .from('budget_settings')
          .update(settings)
          .eq('id', existingSettings.id);

        if (error) throw error;
      } else {
        settings.created_at = new Date().toISOString();
        const { error } = await supabase
          .from('budget_settings')
          .insert([settings]);

        if (error) throw error;
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving budget settings:', error);
      alert('Failed to save budget settings');
    } finally {
      setLoading(false);
    }
  };

  const getNextResetDate = () => {
    const now = new Date();
    let resetDate = new Date();

    switch (periodType) {
      case 'weekly':
        const daysUntilStart = (startDay + 7 - now.getDay()) % 7;
        resetDate.setDate(now.getDate() + (daysUntilStart === 0 ? 7 : daysUntilStart));
        break;

      case 'biweekly':
        // Calculate next occurrence of start day
        const daysUntilBiweekly = (startDay + 7 - now.getDay()) % 7;
        resetDate.setDate(now.getDate() + (daysUntilBiweekly === 0 ? 7 : daysUntilBiweekly));
        // Check if it's been 2 weeks since last reset (simplified)
        break;

      case 'monthly':
        if (now.getDate() >= monthlyStartDay) {
          // Next month
          resetDate.setMonth(now.getMonth() + 1);
        }
        resetDate.setDate(monthlyStartDay);
        break;

      case 'custom':
        if (customStartDate) {
          const startDate = new Date(customStartDate);
          const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const periodsElapsed = Math.floor(daysSinceStart / customLength);
          resetDate = new Date(startDate);
          resetDate.setDate(startDate.getDate() + (periodsElapsed + 1) * customLength);
        }
        break;
    }

    return resetDate.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl rounded-2xl border border-white/20 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">⚙️ Budget Period Settings</h2>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="space-y-6">
            {/* Period Type */}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">
                Budget Period Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['weekly', 'biweekly', 'monthly', 'custom'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setPeriodType(type)}
                    className={`px-4 py-3 rounded-lg font-medium transition-all ${
                      periodType === type
                        ? 'bg-violet-500/30 border-2 border-violet-400/50 text-white'
                        : 'bg-white/5 border-2 border-white/10 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Weekly/Biweekly - Start Day */}
            {(periodType === 'weekly' || periodType === 'biweekly') && (
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  {periodType === 'weekly' ? 'Week starts on' : 'Pay day (every 2 weeks)'}
                </label>
                <select
                  value={startDay}
                  onChange={(e) => setStartDay(parseInt(e.target.value))}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  {DAYS_OF_WEEK.map((day, index) => (
                    <option key={index} value={index} className="bg-slate-800">
                      {day}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Monthly - Start Day */}
            {periodType === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Day of month (1-31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={monthlyStartDay}
                  onChange={(e) => setMonthlyStartDay(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  placeholder="1"
                />
              </div>
            )}

            {/* Custom Period */}
            {periodType === 'custom' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Period Start Date
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Period Length (days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={customLength}
                    onChange={(e) => setCustomLength(parseInt(e.target.value) || 7)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                    placeholder="7"
                  />
                </div>
              </>
            )}

            {/* Preview */}
            <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-4">
              <div className="text-sm text-white/80">
                <div className="font-semibold text-white mb-1">Next Budget Reset:</div>
                <div className="text-violet-300">{getNextResetDate()}</div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-violet-500 hover:bg-violet-600 disabled:bg-violet-500/50 text-white font-semibold rounded-lg transition-all"
              >
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-lg transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
