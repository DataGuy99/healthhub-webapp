import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface IncomeSettings {
  id?: string;
  user_id?: string;
  post_tax_hourly_rate: number;
  hours_per_week: number;
  created_at?: string;
  updated_at?: string;
}

interface RecurringBill {
  id: string;
  name: string;
  amount: number;
  is_income: boolean;
  provider?: string;
}

export function IncomeCalculator() {
  const [incomeSettings, setIncomeSettings] = useState<IncomeSettings | null>(null);
  const [hourlyRate, setHourlyRate] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState('');
  const [bills, setBills] = useState<RecurringBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Load income settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('income_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        throw settingsError;
      }

      if (settingsData) {
        setIncomeSettings(settingsData);
        setHourlyRate(settingsData.post_tax_hourly_rate.toString());
        setHoursPerWeek(settingsData.hours_per_week.toString());
      } else {
        setEditing(true); // Show form if no settings exist
      }

      // Load all recurring bills (expenses only)
      const { data: billsData, error: billsError } = await supabase
        .from('recurring_bills')
        .select('id, name, amount, is_income, provider')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (billsError) throw billsError;
      setBills(billsData || []);

      setLoading(false);
    } catch (error) {
      console.error('Error loading income calculator data:', error);
      setLoading(false);
    }
  };

  const saveIncomeSettings = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const rate = parseFloat(hourlyRate);
      const hours = parseFloat(hoursPerWeek);

      if (!rate || rate <= 0 || !hours || hours <= 0) {
        alert('Please enter valid hourly rate and hours per week');
        return;
      }

      if (incomeSettings?.id) {
        // Update existing
        const { error } = await supabase
          .from('income_settings')
          .update({
            post_tax_hourly_rate: rate,
            hours_per_week: hours,
            updated_at: new Date().toISOString(),
          })
          .eq('id', incomeSettings.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('income_settings')
          .insert({
            user_id: user.id,
            post_tax_hourly_rate: rate,
            hours_per_week: hours,
          });

        if (error) throw error;
      }

      setEditing(false);
      loadData();
    } catch (error) {
      console.error('Error saving income settings:', error);
      alert('Failed to save income settings');
    }
  };

  // Calculate totals
  const expenses = bills.filter(b => !b.is_income);
  const income = bills.filter(b => b.is_income);

  const monthlyExpenses = expenses.reduce((sum, b) => sum + b.amount, 0);
  const monthlyIncome = income.reduce((sum, b) => sum + b.amount, 0);
  const netMonthly = monthlyIncome - monthlyExpenses;

  // Calculate hours needed to cover expenses
  const rate = parseFloat(hourlyRate) || 0;
  const hoursNeededForExpenses = rate > 0 ? monthlyExpenses / rate : 0;
  const weeksNeededForExpenses = hoursPerWeek ? hoursNeededForExpenses / parseFloat(hoursPerWeek) : 0;

  // Calculate weekly breakdown
  const weeklyExpenses = monthlyExpenses / 4.33; // Average weeks per month
  const weeklyIncome = monthlyIncome / 4.33;
  const hoursPerWeekNeeded = rate > 0 ? weeklyExpenses / rate : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Loading income calculator...</div>
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
          <h2 className="text-3xl font-bold text-white">💰 Income Calculator</h2>
          <p className="text-white/60 text-sm">Calculate hours needed to cover your expenses</p>
        </div>
        {!editing && incomeSettings && (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 hover:from-green-500/30 hover:to-emerald-500/30 border border-green-500/30 text-green-300 font-medium transition-all"
          >
            ✏️ Edit Settings
          </button>
        )}
      </div>

      {/* Income Settings Form */}
      {editing && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-xl rounded-2xl border border-green-500/20 p-6"
        >
          <h3 className="text-xl font-bold text-white mb-4">Income Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-white/80 text-sm mb-2">Post-Tax Hourly Rate ($)</label>
              <input
                type="number"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="25.00"
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-green-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-white/80 text-sm mb-2">Hours Per Week</label>
              <input
                type="number"
                step="0.5"
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(e.target.value)}
                placeholder="40"
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-green-500/50 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={saveIncomeSettings}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium hover:shadow-lg hover:shadow-green-500/50 transition-all"
            >
              Save Settings
            </button>
            {incomeSettings && (
              <button
                onClick={() => {
                  setHourlyRate(incomeSettings.post_tax_hourly_rate.toString());
                  setHoursPerWeek(incomeSettings.hours_per_week.toString());
                  setEditing(false);
                }}
                className="px-6 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Income Overview */}
      {incomeSettings && !editing && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-xl rounded-2xl border border-green-500/30 p-6">
            <div className="text-white/70 text-sm mb-1">Your Hourly Rate (Post-Tax)</div>
            <div className="text-white text-4xl font-bold">${incomeSettings.post_tax_hourly_rate.toFixed(2)}</div>
            <div className="text-white/60 text-sm mt-2">{incomeSettings.hours_per_week} hours/week</div>
          </div>
          <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-xl rounded-2xl border border-blue-500/30 p-6">
            <div className="text-white/70 text-sm mb-1">Monthly Earning Potential</div>
            <div className="text-white text-4xl font-bold">
              ${(incomeSettings.post_tax_hourly_rate * incomeSettings.hours_per_week * 4.33).toFixed(2)}
            </div>
            <div className="text-white/60 text-sm mt-2">Based on {incomeSettings.hours_per_week} hrs/week</div>
          </div>
        </div>
      )}

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-red-500/20 to-rose-500/20 backdrop-blur-xl rounded-2xl border border-red-500/30 p-6">
          <div className="text-white/70 text-sm mb-1">Monthly Expenses</div>
          <div className="text-white text-3xl font-bold">${monthlyExpenses.toFixed(2)}</div>
          <div className="text-white/60 text-sm mt-2">{expenses.length} recurring bills</div>
        </div>
        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-xl rounded-2xl border border-green-500/30 p-6">
          <div className="text-white/70 text-sm mb-1">Monthly Income</div>
          <div className="text-white text-3xl font-bold">${monthlyIncome.toFixed(2)}</div>
          <div className="text-white/60 text-sm mt-2">{income.length} income sources</div>
        </div>
        <div className={`bg-gradient-to-r ${netMonthly >= 0 ? 'from-blue-500/20 to-cyan-500/20 border-blue-500/30' : 'from-orange-500/20 to-amber-500/20 border-orange-500/30'} backdrop-blur-xl rounded-2xl border p-6`}>
          <div className="text-white/70 text-sm mb-1">Net Monthly</div>
          <div className="text-white text-3xl font-bold">${netMonthly.toFixed(2)}</div>
          <div className="text-white/60 text-sm mt-2">{netMonthly >= 0 ? 'Surplus' : 'Deficit'}</div>
        </div>
      </div>

      {/* Hours Needed Breakdown */}
      {incomeSettings && (
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-xl rounded-2xl border border-purple-500/20 p-6">
          <h3 className="text-2xl font-bold text-white mb-6">⏱️ Hours Needed to Cover Expenses</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Monthly Calculation */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-white/80">Monthly Expenses:</span>
                <span className="text-white font-bold text-xl">${monthlyExpenses.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-white/80">Your Hourly Rate:</span>
                <span className="text-white font-bold">${incomeSettings.post_tax_hourly_rate.toFixed(2)}/hr</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-purple-500/30">
                <span className="text-white/80">Hours Needed (Monthly):</span>
                <span className="text-purple-300 font-bold text-2xl">{hoursNeededForExpenses.toFixed(1)} hrs</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/80">Weeks of Work Needed:</span>
                <span className="text-purple-300 font-bold text-xl">{weeksNeededForExpenses.toFixed(1)} weeks</span>
              </div>
            </div>

            {/* Weekly Calculation */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-white/80">Weekly Expenses:</span>
                <span className="text-white font-bold text-xl">${weeklyExpenses.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-white/80">Your Hourly Rate:</span>
                <span className="text-white font-bold">${incomeSettings.post_tax_hourly_rate.toFixed(2)}/hr</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-purple-500/30">
                <span className="text-white/80">Hours Needed (Weekly):</span>
                <span className="text-pink-300 font-bold text-2xl">{hoursPerWeekNeeded.toFixed(1)} hrs</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/80">% of Work Week:</span>
                <span className="text-pink-300 font-bold text-xl">
                  {incomeSettings.hours_per_week > 0 ? ((hoursPerWeekNeeded / incomeSettings.hours_per_week) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/80 text-sm">Expenses vs. Available Hours</span>
              <span className="text-white/60 text-sm">
                {hoursPerWeekNeeded.toFixed(1)} / {incomeSettings.hours_per_week} hrs/week
              </span>
            </div>
            <div className="w-full h-4 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  hoursPerWeekNeeded / incomeSettings.hours_per_week > 1
                    ? 'bg-gradient-to-r from-red-500 to-orange-500'
                    : hoursPerWeekNeeded / incomeSettings.hours_per_week > 0.8
                    ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                    : 'bg-gradient-to-r from-green-500 to-emerald-500'
                }`}
                style={{
                  width: `${Math.min((hoursPerWeekNeeded / incomeSettings.hours_per_week) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Expense Breakdown */}
      {expenses.length > 0 && (
        <div className="bg-gradient-to-r from-red-500/10 to-rose-500/10 backdrop-blur-xl rounded-2xl border border-red-500/20 p-6">
          <h3 className="text-xl font-bold text-white mb-4">📊 Expense Breakdown</h3>
          <div className="space-y-3">
            {expenses
              .sort((a, b) => b.amount - a.amount)
              .map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                >
                  <div>
                    <div className="text-white font-medium">{bill.name}</div>
                    {bill.provider && (
                      <div className="text-white/50 text-sm">{bill.provider}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold">${bill.amount.toFixed(2)}</div>
                    {incomeSettings && (
                      <div className="text-white/50 text-sm">
                        {(bill.amount / incomeSettings.post_tax_hourly_rate).toFixed(1)} hrs
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Income Sources */}
      {income.length > 0 && (
        <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-xl rounded-2xl border border-green-500/20 p-6">
          <h3 className="text-xl font-bold text-white mb-4">💵 Income Sources</h3>
          <div className="space-y-3">
            {income
              .sort((a, b) => b.amount - a.amount)
              .map((source) => (
                <div
                  key={source.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                >
                  <div>
                    <div className="text-white font-medium">{source.name}</div>
                    {source.provider && (
                      <div className="text-white/50 text-sm">{source.provider}</div>
                    )}
                  </div>
                  <div className="text-green-300 font-bold">${source.amount.toFixed(2)}</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
