import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface MiscShopBudget {
  id: string;
  user_id: string;
  monthly_budget: number;
  rollover_savings: number;
  created_at: string;
  updated_at: string;
}

interface MiscShopPurchase {
  id: string;
  user_id: string;
  item_name: string;
  amount: number;
  date: string;
  month: string; // YYYY-MM format
  is_big_purchase: boolean;
  notes: string | null;
  created_at: string;
}

export const MiscShopTracker: React.FC = () => {
  const [budget, setBudget] = useState<MiscShopBudget | null>(null);
  const [purchases, setPurchases] = useState<MiscShopPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  // Budget settings
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [editMonthlyBudget, setEditMonthlyBudget] = useState('30.00');

  // New purchase form
  const [showAddPurchase, setShowAddPurchase] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newIsBigPurchase, setNewIsBigPurchase] = useState(false);
  const [newNotes, setNewNotes] = useState('');

  // Month navigation
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().substring(0, 7));

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load budget settings
      let { data: budgetData, error: budgetError } = await supabase
        .from('misc_shop_budgets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (budgetError && budgetError.code !== 'PGRST116') {
        console.error('Error loading budget:', budgetError);
      }

      // Create default budget if doesn't exist
      if (!budgetData) {
        const { data: newBudget, error: createError } = await supabase
          .from('misc_shop_budgets')
          .insert({
            user_id: user.id,
            monthly_budget: 30.00,
            rollover_savings: 0.00
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating budget:', createError);
        } else {
          budgetData = newBudget;
        }
      }

      // Normalize numeric fields from Supabase
      const normalizedBudget = budgetData
        ? {
            ...budgetData,
            monthly_budget: Number(budgetData.monthly_budget),
            rollover_savings: Number(budgetData.rollover_savings),
          }
        : null;

      setBudget(normalizedBudget);
      setEditMonthlyBudget(
        normalizedBudget ? normalizedBudget.monthly_budget.toFixed(2) : '30.00'
      );

      // Load purchases for current month
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('misc_shop_purchases')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .order('date', { ascending: false });

      if (purchasesError) {
        console.error('Error loading purchases:', purchasesError);
      } else {
        setPurchases(
          (purchasesData || []).map((purchase) => ({
            ...purchase,
            amount: Number(purchase.amount),
          }))
        );
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateBudget = async () => {
    if (!budget) return;

    try {
      const { error } = await supabase
        .from('misc_shop_budgets')
        .update({
          monthly_budget: parseFloat(editMonthlyBudget),
          updated_at: new Date().toISOString()
        })
        .eq('id', budget.id);

      if (error) {
        console.error('Error updating budget:', error);
        alert('Failed to update budget');
      } else {
        await loadData();
        setIsEditingBudget(false);
      }
    } catch (error) {
      console.error('Error updating budget:', error);
      alert('Failed to update budget');
    }
  };

  const addPurchase = async () => {
    if (!newItemName.trim() || !newAmount || parseFloat(newAmount) <= 0) {
      alert('Please enter item name and valid amount');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const amount = parseFloat(newAmount);
      const purchaseDate = new Date(newDate);
      const month = purchaseDate.toISOString().substring(0, 7);

      const { error } = await supabase
        .from('misc_shop_purchases')
        .insert({
          user_id: user.id,
          item_name: newItemName.trim(),
          amount: amount,
          date: newDate,
          month: month,
          is_big_purchase: newIsBigPurchase,
          notes: newNotes.trim() || null
        });

      if (error) {
        console.error('Error adding purchase:', error);
        alert('Failed to add purchase');
      } else {
        // Reset form
        setNewItemName('');
        setNewAmount('');
        setNewDate(new Date().toISOString().split('T')[0]);
        setNewIsBigPurchase(false);
        setNewNotes('');
        setShowAddPurchase(false);

        // Reload data
        await loadData();
      }
    } catch (error) {
      console.error('Error adding purchase:', error);
      alert('Failed to add purchase');
    }
  };

  const deletePurchase = async (id: string) => {
    if (!confirm('Delete this purchase?')) return;

    try {
      const { error } = await supabase
        .from('misc_shop_purchases')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting purchase:', error);
        alert('Failed to delete purchase');
      } else {
        await loadData();
      }
    } catch (error) {
      console.error('Error deleting purchase:', error);
      alert('Failed to delete purchase');
    }
  };

  const rolloverToSavings = async () => {
    if (!budget) return;

    const monthSpent = purchases.reduce((sum, p) => sum + p.amount, 0);
    const monthRemaining = budget.monthly_budget - monthSpent;

    if (monthRemaining <= 0) {
      alert('No remaining budget to roll over this month');
      return;
    }

    if (!confirm(`Roll over $${monthRemaining.toFixed(2)} to savings?`)) return;

    try {
      const newRollover = budget.rollover_savings + monthRemaining;

      const { error } = await supabase
        .from('misc_shop_budgets')
        .update({
          rollover_savings: newRollover,
          updated_at: new Date().toISOString()
        })
        .eq('id', budget.id);

      if (error) {
        console.error('Error rolling over savings:', error);
        alert('Failed to roll over savings');
      } else {
        await loadData();
        alert(`Successfully rolled over $${monthRemaining.toFixed(2)} to savings!`);
      }
    } catch (error) {
      console.error('Error rolling over savings:', error);
      alert('Failed to roll over savings');
    }
  };

  const useSavingsForPurchase = async () => {
    if (!budget || budget.rollover_savings <= 0) {
      alert('No rollover savings available');
      return;
    }

    const amount = prompt(`Enter amount to use from savings (Available: $${budget.rollover_savings.toFixed(2)}):`);
    if (!amount) return;

    const useAmount = parseFloat(amount);
    if (isNaN(useAmount) || useAmount <= 0 || useAmount > budget.rollover_savings) {
      alert('Invalid amount');
      return;
    }

    try {
      const newRollover = budget.rollover_savings - useAmount;

      const { error } = await supabase
        .from('misc_shop_budgets')
        .update({
          rollover_savings: newRollover,
          updated_at: new Date().toISOString()
        })
        .eq('id', budget.id);

      if (error) {
        console.error('Error using savings:', error);
        alert('Failed to use savings');
      } else {
        await loadData();
        alert(`Used $${useAmount.toFixed(2)} from rollover savings!`);
      }
    } catch (error) {
      console.error('Error using savings:', error);
      alert('Failed to use savings');
    }
  };

  const changeMonth = (direction: 'prev' | 'next') => {
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1);

    if (direction === 'prev') {
      date.setMonth(date.getMonth() - 1);
    } else {
      date.setMonth(date.getMonth() + 1);
    }

    setCurrentMonth(date.toISOString().substring(0, 7));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="text-center p-8 text-gray-400">
        Failed to load budget data
      </div>
    );
  }

  // Calculate month stats
  const monthSpent = purchases.reduce((sum, p) => sum + p.amount, 0);
  const monthRemaining = budget.monthly_budget - monthSpent;
  const totalAvailable = monthRemaining + budget.rollover_savings;
  const percentUsed =
    budget.monthly_budget > 0
      ? (monthSpent / budget.monthly_budget) * 100
      : 0;

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  return (
    <div className="space-y-6">
      {/* Budget Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl p-6 border border-purple-500/20"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white">Misc Shop Budget</h2>
          {!isEditingBudget && (
            <button
              onClick={() => setIsEditingBudget(true)}
              className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg transition-colors"
            >
              Edit Budget
            </button>
          )}
        </div>

        {isEditingBudget ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm text-gray-400 mb-2">Monthly Budget</label>
              <div className="flex items-center gap-2">
                <span className="text-white text-xl">$</span>
                <input
                  type="number"
                  value={editMonthlyBudget}
                  onChange={(e) => setEditMonthlyBudget(e.target.value)}
                  step="0.01"
                  min="0"
                  className="flex-1 bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={updateBudget}
                className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditingBudget(false);
                  setEditMonthlyBudget(budget.monthly_budget.toFixed(2));
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-400">Monthly Budget</div>
              <div className="text-3xl font-bold text-white">${budget.monthly_budget.toFixed(2)}</div>
            </div>

            <div>
              <div className="text-sm text-gray-400">Rollover Savings</div>
              <div className="text-3xl font-bold text-green-400">${budget.rollover_savings.toFixed(2)}</div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between bg-gray-800/50 rounded-lg p-4">
        <button
          onClick={() => changeMonth('prev')}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <h3 className="text-xl font-semibold text-white">{formatMonth(currentMonth)}</h3>

        <button
          onClick={() => changeMonth('next')}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Month Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-3 gap-4"
      >
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Spent This Month</div>
          <div className="text-2xl font-bold text-white">${monthSpent.toFixed(2)}</div>
          <div className="text-xs text-gray-500 mt-1">{percentUsed.toFixed(0)}% of budget</div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Month Remaining</div>
          <div className={`text-2xl font-bold ${monthRemaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${monthRemaining.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {monthRemaining >= 0 ? 'Under budget' : 'Over budget'}
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="text-sm text-gray-400 mb-1">Total Available</div>
          <div className="text-2xl font-bold text-purple-400">${totalAvailable.toFixed(2)}</div>
          <div className="text-xs text-gray-500 mt-1">Budget + savings</div>
        </div>
      </motion.div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-400">
          <span>Budget Progress</span>
          <span>{percentUsed.toFixed(0)}%</span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentUsed, 100)}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`h-full rounded-full ${
              percentUsed <= 80 ? 'bg-green-500' :
              percentUsed <= 100 ? 'bg-yellow-500' :
              'bg-red-500'
            }`}
          />
        </div>
      </div>

      {/* Rollover Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={rolloverToSavings}
          disabled={monthRemaining <= 0}
          className="px-4 py-3 bg-green-500/20 hover:bg-green-500/30 disabled:bg-gray-700 disabled:text-gray-500 text-green-300 rounded-lg transition-colors"
        >
          💰 Roll Over to Savings
        </button>

        <button
          onClick={useSavingsForPurchase}
          disabled={budget.rollover_savings <= 0}
          className="px-4 py-3 bg-purple-500/20 hover:bg-purple-500/30 disabled:bg-gray-700 disabled:text-gray-500 text-purple-300 rounded-lg transition-colors"
        >
          🎁 Use Savings
        </button>
      </div>

      {/* Add Purchase Button */}
      <button
        onClick={() => setShowAddPurchase(true)}
        className="w-full px-6 py-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 text-white rounded-xl border border-purple-500/20 transition-all"
      >
        + Add Purchase
      </button>

      {/* Add Purchase Form */}
      <AnimatePresence>
        {showAddPurchase && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 space-y-4"
          >
            <h3 className="text-xl font-semibold text-white mb-4">New Purchase</h3>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Item Name</label>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="e.g., Coffee maker"
                className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Amount</label>
              <div className="flex items-center gap-2">
                <span className="text-white text-xl">$</span>
                <input
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="flex-1 bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isBigPurchase"
                checked={newIsBigPurchase}
                onChange={(e) => setNewIsBigPurchase(e.target.checked)}
                className="w-4 h-4 text-purple-500 bg-gray-800 border-gray-700 rounded focus:ring-purple-500"
              />
              <label htmlFor="isBigPurchase" className="text-sm text-gray-300">
                Big Purchase (using savings)
              </label>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Notes (optional)</label>
              <textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Additional details..."
                rows={2}
                className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-purple-500 focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={addPurchase}
                className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
              >
                Add Purchase
              </button>
              <button
                onClick={() => {
                  setShowAddPurchase(false);
                  setNewItemName('');
                  setNewAmount('');
                  setNewDate(new Date().toISOString().split('T')[0]);
                  setNewIsBigPurchase(false);
                  setNewNotes('');
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchases List */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-white">
          Purchases ({purchases.length})
        </h3>

        <AnimatePresence>
          {purchases.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-12 text-gray-400"
            >
              No purchases this month
            </motion.div>
          ) : (
            purchases.map((purchase) => (
              <motion.div
                key={purchase.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`bg-gray-800/50 rounded-lg p-4 border ${
                  purchase.is_big_purchase ? 'border-purple-500/30' : 'border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-semibold text-white">{purchase.item_name}</h4>
                      {purchase.is_big_purchase && (
                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded-full">
                          Big Purchase
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-gray-400 mt-1">
                      {new Date(purchase.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </div>

                    {purchase.notes && (
                      <div className="text-sm text-gray-500 mt-2">{purchase.notes}</div>
                    )}
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="text-right">
                      <div className="text-xl font-bold text-white">
                        ${purchase.amount.toFixed(2)}
                      </div>
                    </div>

                    <button
                      onClick={() => deletePurchase(purchase.id)}
                      className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
