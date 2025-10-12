import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase, CategoryLog } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface SpendingTrackerProps {
  category: string;
  categoryName: string;
  icon: string;
  color: string;
  onBack: () => void;
}

export function SpendingTracker({ category, categoryName, icon, color, onBack }: SpendingTrackerProps) {
  const [expenses, setExpenses] = useState<CategoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExpenseDescription, setNewExpenseDescription] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpenseDate, setNewExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const startDate = `${currentMonth}-01`;
      const endDate = `${currentMonth}-31`;

      const { data: expensesData, error: expensesError } = await supabase
        .from('category_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (expensesError) throw expensesError;

      // Filter to this category's expenses
      const filteredExpenses = expensesData?.filter((expense: any) => {
        try {
          const metadata = JSON.parse(expense.notes || '{}');
          return metadata.category === category;
        } catch {
          return false;
        }
      }) || [];

      setExpenses(filteredExpenses);
      setLoading(false);
    } catch (error) {
      console.error('Error loading spending data:', error);
      setLoading(false);
    }
  };

  const addExpense = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      if (!newExpenseDescription.trim()) {
        alert('Please enter a description');
        return;
      }

      if (!newExpenseAmount || parseFloat(newExpenseAmount) <= 0) {
        alert('Please enter a valid amount');
        return;
      }

      // Create a pseudo category_item for this expense
      const { data: itemData, error: itemError } = await supabase
        .from('category_items')
        .insert({
          user_id: user.id,
          category: category,
          name: newExpenseDescription.trim(),
          amount: parseFloat(newExpenseAmount),
          frequency: 'one-time',
          is_active: false
        })
        .select()
        .single();

      if (itemError) throw itemError;

      // Log the expense
      const metadata = {
        category: category,
        type: 'expense',
        description: newExpenseDescription.trim()
      };

      const { error: logError } = await supabase
        .from('category_logs')
        .insert({
          user_id: user.id,
          category_item_id: itemData.id,
          date: newExpenseDate,
          amount_logged: parseFloat(newExpenseAmount),
          notes: JSON.stringify(metadata),
          timestamp: new Date().toISOString()
        });

      if (logError) throw logError;

      setNewExpenseDescription('');
      setNewExpenseAmount('');
      setNewExpenseDate(new Date().toISOString().split('T')[0]);
      setShowAddExpense(false);
      loadData();
    } catch (error) {
      console.error('Error adding expense:', error);
      alert('Failed to add expense');
    }
  };

  const deleteExpense = async (expense: CategoryLog) => {
    if (!confirm('Delete this expense?')) return;

    try {
      const { error } = await supabase
        .from('category_logs')
        .delete()
        .eq('id', expense.id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting expense:', error);
      alert('Failed to delete expense');
    }
  };

  // Calculate totals
  const totalSpent = expenses.reduce((sum, exp) => sum + (exp.amount_logged || 0), 0);
  const averagePerExpense = expenses.length > 0 ? totalSpent / expenses.length : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Loading expenses...</div>
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
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
          >
            ← Back
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">{icon} {categoryName}</h2>
            <p className="text-white/60 text-sm">Track your spending</p>
          </div>
        </div>
        <button
          onClick={() => setShowAddExpense(!showAddExpense)}
          className={`px-4 py-2 rounded-lg bg-gradient-to-r ${color} font-medium transition-all hover:scale-105`}
        >
          {showAddExpense ? '✕ Cancel' : '+ Add Expense'}
        </button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-4">
        <button
          onClick={() => {
            const date = new Date(currentMonth + '-01');
            date.setMonth(date.getMonth() - 1);
            setCurrentMonth(date.toISOString().slice(0, 7));
          }}
          className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-sm transition-all"
        >
          ← Previous
        </button>
        <div className="text-white font-semibold">
          {new Date(currentMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <button
          onClick={() => {
            const date = new Date(currentMonth + '-01');
            date.setMonth(date.getMonth() + 1);
            setCurrentMonth(date.toISOString().slice(0, 7));
          }}
          className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-sm transition-all"
        >
          Next →
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`bg-gradient-to-r ${color} backdrop-blur-xl rounded-2xl border p-5`}>
          <div className="text-white/70 text-sm mb-1">Total Spent</div>
          <div className="text-white text-2xl font-bold">${totalSpent.toFixed(2)}</div>
        </div>
        <div className={`bg-gradient-to-r ${color} backdrop-blur-xl rounded-2xl border p-5`}>
          <div className="text-white/70 text-sm mb-1">Transactions</div>
          <div className="text-white text-2xl font-bold">{expenses.length}</div>
        </div>
        <div className={`bg-gradient-to-r ${color} backdrop-blur-xl rounded-2xl border p-5`}>
          <div className="text-white/70 text-sm mb-1">Average per Transaction</div>
          <div className="text-white text-2xl font-bold">${averagePerExpense.toFixed(2)}</div>
        </div>
      </div>

      {/* Add Expense Form */}
      {showAddExpense && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Add New Expense</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Description (e.g., Walmart groceries)"
              value={newExpenseDescription}
              onChange={(e) => setNewExpenseDescription(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Amount"
              value={newExpenseAmount}
              onChange={(e) => setNewExpenseAmount(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <div className="relative">
              <input
                type="date"
                value={newExpenseDate}
                onChange={(e) => setNewExpenseDate(e.target.value)}
                className="w-full px-4 py-2 pl-10 bg-gradient-to-r from-white/10 to-white/5 border border-white/30 rounded-xl text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 hover:border-white/40 transition-all cursor-pointer backdrop-blur-sm"
                style={{ colorScheme: 'dark' }}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg pointer-events-none">
                📅
              </span>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={addExpense}
              className="px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 font-medium transition-all"
            >
              Add Expense
            </button>
          </div>
        </motion.div>
      )}

      {/* Expenses List */}
      <div className="space-y-3">
        {expenses.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-12 text-center">
            <div className="text-white/40 text-lg mb-2">No expenses recorded</div>
            <div className="text-white/60 text-sm">Click "Add Expense" to track your spending</div>
          </div>
        ) : (
          expenses.map((expense) => {
            const metadata = (() => {
              try {
                return JSON.parse(expense.notes || '{}');
              } catch {
                return {};
              }
            })();

            return (
              <div
                key={expense.id}
                className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-5 hover:bg-white/8 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-2xl">💳</div>
                      <div>
                        <div className="font-semibold text-white text-lg">
                          {metadata.description || 'Expense'}
                        </div>
                        <div className="text-sm text-white/60">
                          {new Date(expense.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="ml-11">
                      <div className="text-2xl font-bold text-green-400">
                        ${(expense.amount_logged || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteExpense(expense)}
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
