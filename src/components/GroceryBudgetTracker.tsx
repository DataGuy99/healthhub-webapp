import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';
import { useBudgetPeriod } from '../hooks/useBudgetPeriod';

interface GroceryPurchase {
  id?: string;
  user_id?: string;
  store: string;
  amount: number;
  date: string;
  notes?: string;
  protein_grams?: number;
  days_covered?: number;
  is_protein_source?: boolean;
  created_at?: string;
}

interface GroceryBudget {
  id?: string;
  user_id?: string;
  weekly_budget: number;
  daily_protein_goal?: number;
  created_at?: string;
  updated_at?: string;
}

interface ProteinCalculation {
  id?: string;
  food_name: string;
  serving_size: number;
  serving_unit: string;
  protein_grams: number;
  price: number;
  cost_per_gram: number;
}

export function GroceryBudgetTracker() {
  const { currentPeriod, formatPeriodDisplay, loading: periodLoading } = useBudgetPeriod();
  const [purchases, setPurchases] = useState<GroceryPurchase[]>([]);
  const [budget, setBudget] = useState<GroceryBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodOffset, setPeriodOffset] = useState(0); // 0 = current, -1 = previous, +1 = next
  const [proteinCalculations, setProteinCalculations] = useState<ProteinCalculation[]>([]);
  const [showProteinSuggestions, setShowProteinSuggestions] = useState(false);

  // Form state
  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [showBudgetSettings, setShowBudgetSettings] = useState(false);
  const [formStore, setFormStore] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formNotes, setFormNotes] = useState('');
  const [formIsProteinSource, setFormIsProteinSource] = useState(false);
  const [formProteinGrams, setFormProteinGrams] = useState('');
  const [formDaysCovered, setFormDaysCovered] = useState('');

  // Budget settings
  const [budgetAmount, setBudgetAmount] = useState('90');
  const [dailyProteinGoal, setDailyProteinGoal] = useState('150');

  useEffect(() => {
    if (currentPeriod && !periodLoading) {
      loadData();
    }
  }, [currentPeriod, periodOffset, periodLoading]);

  const loadData = async () => {
    if (!currentPeriod) return;

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
        setDailyProteinGoal((budgetData.daily_protein_goal || 150).toString());
      }

      // Load protein calculations from protein calculator
      const { data: proteinData, error: proteinError } = await supabase
        .from('protein_calculations')
        .select('*')
        .eq('user_id', user.id)
        .order('cost_per_gram', { ascending: true })
        .limit(20);

      if (proteinError) throw proteinError;
      setProteinCalculations(proteinData || []);

      // Calculate viewing period based on offset
      const viewPeriod = calculateViewPeriod();
      const periodStart = viewPeriod.startDate.toISOString().split('T')[0];
      const periodEnd = new Date(viewPeriod.endDate);
      periodEnd.setDate(periodEnd.getDate() - 1); // End date is exclusive, so subtract 1 day
      const periodEndStr = periodEnd.toISOString().split('T')[0];

      // Load purchases for viewing period
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('grocery_purchases')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', periodStart)
        .lte('date', periodEndStr)
        .order('date', { ascending: false });

      if (purchasesError) throw purchasesError;
      setPurchases(purchasesData || []);

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const calculateViewPeriod = () => {
    if (!currentPeriod) return { startDate: new Date(), endDate: new Date() };

    const periodLengthMs = currentPeriod.endDate.getTime() - currentPeriod.startDate.getTime();
    const offsetMs = periodOffset * periodLengthMs;

    return {
      startDate: new Date(currentPeriod.startDate.getTime() + offsetMs),
      endDate: new Date(currentPeriod.endDate.getTime() + offsetMs),
    };
  };

  const saveBudgetSettings = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const amount = parseFloat(budgetAmount);
      const proteinGoal = parseFloat(dailyProteinGoal);

      if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid budget amount');
        return;
      }

      if (isNaN(proteinGoal) || proteinGoal < 0) {
        alert('Please enter a valid protein goal (0 or higher)');
        return;
      }

      if (budget) {
        // Update existing
        const { error } = await supabase
          .from('grocery_budgets')
          .update({
            weekly_budget: amount,
            daily_protein_goal: proteinGoal,
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
            daily_protein_goal: proteinGoal,
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

      // Validate protein fields if marked as protein source
      if (formIsProteinSource) {
        if (!formProteinGrams || parseFloat(formProteinGrams) <= 0) {
          alert('Please enter protein grams for protein sources');
          return;
        }
        if (!formDaysCovered || parseFloat(formDaysCovered) <= 0) {
          alert('Please enter how many days this protein covers');
          return;
        }
      }

      const { error } = await supabase
        .from('grocery_purchases')
        .insert({
          user_id: user.id,
          store: formStore.trim(),
          amount: parseFloat(formAmount),
          date: formDate,
          notes: formNotes.trim() || null,
          is_protein_source: formIsProteinSource,
          protein_grams: formIsProteinSource ? parseFloat(formProteinGrams) : null,
          days_covered: formIsProteinSource ? parseFloat(formDaysCovered) : null,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Reset form
      setFormStore('');
      setFormAmount('');
      setFormDate(new Date().toISOString().split('T')[0]);
      setFormNotes('');
      setFormIsProteinSource(false);
      setFormProteinGrams('');
      setFormDaysCovered('');
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

  const navigatePeriod = (direction: 'prev' | 'next') => {
    setPeriodOffset(periodOffset + (direction === 'next' ? 1 : -1));
  };

  // Calculate totals
  const periodTotal = purchases.reduce((sum, p) => sum + p.amount, 0);
  const periodBudget = budget?.weekly_budget || 90;
  const remaining = periodBudget - periodTotal;
  const percentUsed = periodBudget > 0 ? (periodTotal / periodBudget) * 100 : 0;

  // Calculate protein tracking
  const dailyGoal = budget?.daily_protein_goal || 0;
  const daysInPeriod = currentPeriod ? Math.ceil((currentPeriod.endDate.getTime() - currentPeriod.startDate.getTime()) / (1000 * 60 * 60 * 24)) : 7;
  const periodProteinGoal = dailyGoal * daysInPeriod;

  // Calculate protein secured and spent on protein
  const proteinPurchases = purchases.filter(p => p.is_protein_source);
  const proteinSpent = proteinPurchases.reduce((sum, p) => sum + p.amount, 0);
  const proteinSecured = proteinPurchases.reduce((sum, p) => sum + (p.protein_grams || 0), 0);
  const proteinGap = Math.max(0, periodProteinGoal - proteinSecured);
  const budgetAfterProtein = remaining; // Remaining budget after all spending

  // Calculate protein coverage
  const daysCovered = dailyGoal > 0 ? proteinSecured / dailyGoal : 0;
  const daysRemaining = Math.max(0, daysInPeriod - daysCovered);

  // Smart suggestions: find protein sources that fit remaining budget
  const affordableSuggestions = proteinCalculations
    .filter(calc => calc.price <= budgetAfterProtein) // Can afford whole item
    .map(calc => ({
      ...calc,
      items_needed: Math.ceil(proteinGap / calc.protein_grams), // Round up to whole items
      total_cost: Math.ceil(proteinGap / calc.protein_grams) * calc.price,
      total_protein: Math.ceil(proteinGap / calc.protein_grams) * calc.protein_grams,
    }))
    .filter(s => s.total_cost <= budgetAfterProtein) // Total cost within budget
    .sort((a, b) => a.total_cost - b.total_cost) // Cheapest first
    .slice(0, 5); // Top 5 suggestions

  const viewPeriod = calculateViewPeriod();

  const isCurrentPeriod = () => {
    return periodOffset === 0;
  };

  if (loading || periodLoading) {
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
          <p className="text-white/60 text-sm">Track your grocery spending per budget period</p>
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
          <h3 className="text-lg font-semibold text-white mb-4">Budget & Protein Settings</h3>
          <p className="text-sm text-white/60 mb-4">
            Budget period is controlled globally from Overview → Budget Period Settings
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">Budget Amount ($)</label>
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
              <label className="block text-sm text-white/70 mb-2">Daily Protein Goal (g)</label>
              <input
                type="number"
                step="1"
                value={dailyProteinGoal}
                onChange={(e) => setDailyProteinGoal(e.target.value)}
                placeholder="150"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              <p className="text-xs text-white/50 mt-1">Set to 0 to disable protein tracking</p>
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

      {/* Period Navigation */}
      <div className="flex items-center justify-between bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-4">
        <button
          onClick={() => navigatePeriod('prev')}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
        >
          ← Previous Period
        </button>
        <div className="text-center">
          <div className="text-white font-bold text-lg">
            {viewPeriod.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(viewPeriod.endDate.getTime() - 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          {isCurrentPeriod() && (
            <div className="text-green-400 text-sm">Current Period</div>
          )}
        </div>
        <button
          onClick={() => navigatePeriod('next')}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
        >
          Next Period →
        </button>
      </div>

      {/* Budget Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-xl rounded-2xl border border-blue-500/30 p-5">
          <div className="text-white/70 text-sm mb-1">Period Budget</div>
          <div className="text-white text-3xl font-bold">${periodBudget.toFixed(2)}</div>
        </div>
        <div className={`bg-gradient-to-r ${remaining >= 0 ? 'from-green-500/20 to-emerald-500/20 border-green-500/30' : 'from-red-500/20 to-rose-500/20 border-red-500/30'} backdrop-blur-xl rounded-2xl border p-5`}>
          <div className="text-white/70 text-sm mb-1">Spent This Period</div>
          <div className="text-white text-3xl font-bold">${periodTotal.toFixed(2)}</div>
          <div className="text-white/60 text-xs mt-1">{percentUsed.toFixed(1)}% of budget</div>
        </div>
        <div className={`bg-gradient-to-r ${remaining >= 0 ? 'from-green-500/20 to-emerald-500/20 border-green-500/30' : 'from-red-500/20 to-rose-500/20 border-red-500/30'} backdrop-blur-xl rounded-2xl border p-5`}>
          <div className="text-white/70 text-sm mb-1">{remaining >= 0 ? 'Remaining' : 'Over Budget'}</div>
          <div className={`text-3xl font-bold ${remaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${Math.abs(remaining).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Protein Tracking Cards (only show if protein goal > 0) */}
      {dailyGoal > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-xl rounded-2xl border border-purple-500/30 p-5">
            <div className="text-white/70 text-sm mb-1">Protein Goal</div>
            <div className="text-white text-2xl font-bold">{periodProteinGoal.toFixed(0)}g</div>
            <div className="text-white/60 text-xs mt-1">{dailyGoal}g/day × {daysInPeriod} days</div>
          </div>
          <div className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 backdrop-blur-xl rounded-2xl border border-orange-500/30 p-5">
            <div className="text-white/70 text-sm mb-1">Protein Secured</div>
            <div className="text-white text-2xl font-bold">{proteinSecured.toFixed(0)}g</div>
            <div className="text-white/60 text-xs mt-1">{daysCovered.toFixed(1)} days covered</div>
          </div>
          <div className={`bg-gradient-to-r ${proteinGap === 0 ? 'from-green-500/20 to-emerald-500/20 border-green-500/30' : 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30'} backdrop-blur-xl rounded-2xl border p-5`}>
            <div className="text-white/70 text-sm mb-1">Protein Gap</div>
            <div className={`text-2xl font-bold ${proteinGap === 0 ? 'text-green-400' : 'text-yellow-400'}`}>
              {proteinGap.toFixed(0)}g
            </div>
            <div className="text-white/60 text-xs mt-1">{daysRemaining.toFixed(1)} days remaining</div>
          </div>
          <div className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 backdrop-blur-xl rounded-2xl border border-cyan-500/30 p-5">
            <div className="text-white/70 text-sm mb-1">Protein Spending</div>
            <div className="text-white text-2xl font-bold">${proteinSpent.toFixed(2)}</div>
            <div className="text-white/60 text-xs mt-1">{proteinPurchases.length} protein purchases</div>
          </div>
        </div>
      )}

      {/* Smart Protein Suggestions (only show if gap exists and suggestions available) */}
      {dailyGoal > 0 && proteinGap > 0 && affordableSuggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-gradient-to-r from-indigo-500/20 to-purple-500/20 backdrop-blur-xl rounded-2xl border border-indigo-500/30 p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">💡 Smart Protein Suggestions</h3>
            <div className="text-sm text-white/60">Based on remaining budget: ${budgetAfterProtein.toFixed(2)}</div>
          </div>
          <div className="space-y-3">
            {affordableSuggestions.map((suggestion, idx) => (
              <div key={idx} className="bg-white/10 rounded-xl p-4 border border-white/20">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-bold text-white">{suggestion.food_name}</div>
                    <div className="text-sm text-white/60 mt-1">
                      {suggestion.items_needed} × {suggestion.serving_size}{suggestion.serving_unit}
                      ({suggestion.protein_grams}g protein each) = {suggestion.total_protein.toFixed(0)}g total
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-green-400">${suggestion.total_cost.toFixed(2)}</div>
                    <div className="text-xs text-white/60">${suggestion.cost_per_gram.toFixed(2)}/g</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-blue-300 text-sm">
              💡 <strong>Tip:</strong> These suggestions will close your {proteinGap.toFixed(0)}g protein gap within your remaining budget.
            </p>
          </div>
        </motion.div>
      )}

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

          {/* Protein Source Toggle (only show if protein goal > 0) */}
          {dailyGoal > 0 && (
            <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="is-protein-source"
                  checked={formIsProteinSource}
                  onChange={(e) => setFormIsProteinSource(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-purple-500/50 bg-white/10 checked:bg-purple-500 focus:ring-2 focus:ring-purple-500/50 cursor-pointer"
                />
                <label htmlFor="is-protein-source" className="text-white font-medium cursor-pointer">
                  🥩 This is a protein source purchase
                </label>
              </div>

              {formIsProteinSource && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3"
                >
                  <div>
                    <label className="block text-sm text-white/70 mb-2">Total Protein (grams)</label>
                    <input
                      type="number"
                      step="1"
                      value={formProteinGrams}
                      onChange={(e) => setFormProteinGrams(e.target.value)}
                      placeholder="e.g., 450"
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                    <p className="text-xs text-white/50 mt-1">Total grams of protein in this purchase</p>
                  </div>
                  <div>
                    <label className="block text-sm text-white/70 mb-2">Days Covered</label>
                    <input
                      type="number"
                      step="0.1"
                      value={formDaysCovered}
                      onChange={(e) => setFormDaysCovered(e.target.value)}
                      placeholder="e.g., 3"
                      className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                    <p className="text-xs text-white/50 mt-1">How many days this protein will last</p>
                  </div>
                </motion.div>
              )}
            </div>
          )}

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
        <h3 className="text-xl font-bold text-white">This Period's Purchases</h3>
        {purchases.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-12 text-center">
            <div className="text-white/40 text-lg mb-2">No purchases this period</div>
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
                    {purchase.is_protein_source && (
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <span className="px-2 py-1 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300">
                          🥩 {purchase.protein_grams}g protein
                        </span>
                        <span className="text-white/60">
                          {purchase.days_covered} days covered
                        </span>
                      </div>
                    )}
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
