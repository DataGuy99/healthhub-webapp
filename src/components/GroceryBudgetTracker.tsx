import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface GroceryPurchase {
  id?: string;
  user_id?: string;
  store: string;
  amount: number;
  date: string;
  week_start: string; // Start of the week this purchase belongs to
  notes?: string;
  created_at?: string;
}

interface GroceryBudget {
  id?: string;
  user_id?: string;
  weekly_budget: number;
  week_start_day: number; // 0=Sunday, 1=Monday, etc.
  created_at?: string;
  updated_at?: string;
}

export function GroceryBudgetTracker() {
  const [purchases, setPurchases] = useState<GroceryPurchase[]>([]);
  const [budget, setBudget] = useState<GroceryBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(new Date());

  // Form state
  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [showBudgetSettings, setShowBudgetSettings] = useState(false);
  const [formStore, setFormStore] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('');

  // Budget settings
  const [budgetAmount, setBudgetAmount] = useState('90');
  const [weekStartDay, setWeekStartDay] = useState(1); // Monday

  useEffect(() => {
    loadData();
  }, [currentWeekStart]);

  useEffect(() => {
    // Calculate week start based on today and budget settings
    const today = new Date();
    const weekStart = getWeekStart(today, budget?.week_start_day || 1);
    setCurrentWeekStart(weekStart);
  }, [budget]);

  const getWeekStart = (date: Date, startDay: number): Date => {
    const result = new Date(date);
    const day = result.getDay();
    const diff = (day < startDay ? day + 7 : day) - startDay;
    result.setDate(result.getDate() - diff);
    result.setHours(0, 0, 0, 0);
    return result;
  };

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Load budget settings
      const { data: budgetData, error: budgetError } = await supabase
        .from('grocery_budgets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (budgetError && budgetError.code !== 'PGRST116') throw budgetError;
      setBudget(budgetData);

      if (budgetData) {
        setBudgetAmount(budgetData.weekly_budget.toString());
        setWeekStartDay(budgetData.week_start_day);
      }

      // Load purchases for current week
      const weekStart = currentWeekStart.toISOString().split('T')[0];
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      const { data: purchasesData, error: purchasesError } = await supabase
        .from('grocery_purchases')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', weekStart)
        .lte('date', weekEndStr)
        .order('date', { ascending: false });

      if (purchasesError) throw purchasesError;
      setPurchases(purchasesData || []);

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const saveBudgetSettings = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const amount = parseFloat(budgetAmount);
      if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid budget amount');
        return;
      }

      if (budget) {
        // Update existing
        const { error } = await supabase
          .from('grocery_budgets')
          .update({
            weekly_budget: amount,
            week_start_day: weekStartDay,
            updated_at: new Date().toISOString(),
          })
          .eq('id', budget.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('grocery_budgets')
          .insert({
            user_id: user.id,
            weekly_budget: amount,
            week_start_day: weekStartDay,
            created_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      setShowBudgetSettings(false);
      loadData();
    } catch (error) {
      console.error('Error saving budget:', error);
      alert('Failed to save budget settings');
    }
  };

  const addPurchase = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      if (!formStore.trim() || !formAmount || parseFloat(formAmount) <= 0) {
        alert('Please fill in store and amount');
        return;
      }

      const purchaseDate = new Date(formDate);
      const weekStart = getWeekStart(purchaseDate, budget?.week_start_day || 1);

      const { error } = await supabase
        .from('grocery_purchases')
        .insert({
          user_id: user.id,
          store: formStore.trim(),
          amount: parseFloat(formAmount),
          date: formDate,
          week_start: weekStart.toISOString().split('T')[0],
          notes: formNotes.trim() || null,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Reset form
      setFormStore('');
      setFormAmount('');
      setFormDate(new Date().toISOString().split('T')[0]);
      setFormNotes('');
      setShowAddPurchase(false);
      loadData();
    } catch (error) {
      console.error('Error adding purchase:', error);
      alert('Failed to add purchase');
    }
  };

  const deletePurchase = async (id: string) => {
    if (!confirm('Delete this purchase?')) return;

    try {
      const { error } = await supabase
        .from('grocery_purchases')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting purchase:', error);
      alert('Failed to delete purchase');
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newWeekStart);
  };

  // Calculate totals
  const weekTotal = purchases.reduce((sum, p) => sum + p.amount, 0);
  const weeklyBudget = budget?.weekly_budget || 90;
  const remaining = weeklyBudget - weekTotal;
  const percentUsed = (weekTotal / weeklyBudget) * 100;

  const weekEndDate = new Date(currentWeekStart);
  weekEndDate.setDate(weekEndDate.getDate() + 6);

  const isCurrentWeek = () => {
    const today = new Date();
    const todayWeekStart = getWeekStart(today, budget?.week_start_day || 1);
    return currentWeekStart.toISOString().split('T')[0] === todayWeekStart.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Loading budget...</div>
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
          <h2 className="text-3xl font-bold text-white">🛒 Grocery Budget</h2>
          <p className="text-white/60 text-sm">Track your weekly grocery spending</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBudgetSettings(!showBudgetSettings)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-500/30 text-purple-300 font-medium transition-all"
          >
            ⚙️ Budget Settings
          </button>
          <button
            onClick={() => setShowAddPurchase(!showAddPurchase)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 hover:from-green-500/30 hover:to-emerald-500/30 border border-green-500/30 text-green-300 font-medium transition-all"
          >
            {showAddPurchase ? '✕ Cancel' : '+ Add Purchase'}
          </button>
        </div>
      </div>

      {/* Budget Settings */}
      {showBudgetSettings && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Budget Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">Weekly Budget ($)</label>
              <input
                type="number"
                step="0.01"
                value={budgetAmount}
                onChange={(e) => setBudgetAmount(e.target.value)}
                placeholder="90.00"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Week Starts On</label>
              <select
                value={weekStartDay}
                onChange={(e) => setWeekStartDay(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              >
                <option value="0" className="bg-slate-800">Sunday</option>
                <option value="1" className="bg-slate-800">Monday</option>
                <option value="2" className="bg-slate-800">Tuesday</option>
                <option value="3" className="bg-slate-800">Wednesday</option>
                <option value="4" className="bg-slate-800">Thursday</option>
                <option value="5" className="bg-slate-800">Friday</option>
                <option value="6" className="bg-slate-800">Saturday</option>
              </select>
            </div>
          </div>
          <button
            onClick={saveBudgetSettings}
            className="mt-4 px-6 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold transition-all"
          >
            Save Settings
          </button>
        </motion.div>
      )}

      {/* Week Navigation */}
      <div className="flex items-center justify-between bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-4">
        <button
          onClick={() => navigateWeek('prev')}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
        >
          ← Previous Week
        </button>
        <div className="text-center">
          <div className="text-white font-bold text-lg">
            {currentWeekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          {isCurrentWeek() && (
            <div className="text-green-400 text-sm">Current Week</div>
          )}
        </div>
        <button
          onClick={() => navigateWeek('next')}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
        >
          Next Week →
        </button>
      </div>

      {/* Budget Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-xl rounded-2xl border border-blue-500/30 p-5">
          <div className="text-white/70 text-sm mb-1">Weekly Budget</div>
          <div className="text-white text-3xl font-bold">${weeklyBudget.toFixed(2)}</div>
        </div>
        <div className={`bg-gradient-to-r ${remaining >= 0 ? 'from-green-500/20 to-emerald-500/20 border-green-500/30' : 'from-red-500/20 to-rose-500/20 border-red-500/30'} backdrop-blur-xl rounded-2xl border p-5`}>
          <div className="text-white/70 text-sm mb-1">Spent This Week</div>
          <div className="text-white text-3xl font-bold">${weekTotal.toFixed(2)}</div>
          <div className="text-white/60 text-xs mt-1">{percentUsed.toFixed(1)}% of budget</div>
        </div>
        <div className={`bg-gradient-to-r ${remaining >= 0 ? 'from-green-500/20 to-emerald-500/20 border-green-500/30' : 'from-red-500/20 to-rose-500/20 border-red-500/30'} backdrop-blur-xl rounded-2xl border p-5`}>
          <div className="text-white/70 text-sm mb-1">{remaining >= 0 ? 'Remaining' : 'Over Budget'}</div>
          <div className={`text-3xl font-bold ${remaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${Math.abs(remaining).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white/70 text-sm">Budget Usage</span>
          <span className="text-white font-semibold">{percentUsed.toFixed(1)}%</span>
        </div>
        <div className="w-full h-4 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              percentUsed <= 80
                ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                : percentUsed <= 100
                ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                : 'bg-gradient-to-r from-red-500 to-rose-500'
            }`}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>
      </div>

      {/* Add Purchase Form */}
      {showAddPurchase && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Add Purchase</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">Store</label>
              <input
                type="text"
                value={formStore}
                onChange={(e) => setFormStore(e.target.value)}
                placeholder="e.g., Walmart, Kroger"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Date</label>
              <div className="relative">
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-4 py-2 pl-10 bg-gradient-to-r from-white/10 to-white/5 border border-white/30 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 hover:border-white/40 transition-all cursor-pointer backdrop-blur-sm"
                  style={{ colorScheme: 'dark' }}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg pointer-events-none">
                  📅
                </span>
              </div>
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm text-white/70 mb-2">Notes (optional)</label>
              <input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="e.g., Weekly shopping, 2 weeks worth"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500/50"
              />
            </div>
          </div>
          <button
            onClick={addPurchase}
            className="mt-4 px-6 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold transition-all"
          >
            Add Purchase
          </button>
        </motion.div>
      )}

      {/* Purchases List */}
      <div className="space-y-3">
        <h3 className="text-xl font-bold text-white">This Week's Purchases</h3>
        {purchases.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-12 text-center">
            <div className="text-white/40 text-lg mb-2">No purchases this week</div>
            <div className="text-white/60 text-sm">Click "Add Purchase" to log your grocery spending</div>
          </div>
        ) : (
          purchases.map((purchase) => (
            <div
              key={purchase.id}
              className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5 hover:bg-white/8 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="text-3xl">🛒</div>
                    <div>
                      <div className="font-bold text-white text-lg">{purchase.store}</div>
                      <div className="text-sm text-white/60">
                        {new Date(purchase.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="ml-11">
                    <div className="text-2xl font-bold text-green-400">${purchase.amount.toFixed(2)}</div>
                    {purchase.notes && (
                      <div className="mt-2 text-sm text-white/70 bg-black/20 rounded-lg p-3">
                        {purchase.notes}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deletePurchase(purchase.id!)}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm transition-all"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
