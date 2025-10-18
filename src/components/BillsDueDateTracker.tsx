import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface Bill {
  id?: string;
  user_id?: string;
  name: string;
  provider: string;
  amount?: number;
  due_day: number; // Day of month (1-31)
  category: 'utilities' | 'subscription' | 'insurance' | 'loan' | 'other';
  auto_pay: boolean;
  notes?: string;
  created_at?: string;
}

const CATEGORIES = ['utilities', 'subscription', 'insurance', 'loan', 'other'] as const;

const CATEGORY_ICONS: Record<string, string> = {
  utilities: '💡',
  subscription: '📺',
  insurance: '🛡️',
  loan: '🏦',
  other: '📄',
};

export function BillsDueDateTracker() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBill, setNewBill] = useState<Partial<Bill>>({
    name: '',
    provider: '',
    due_day: 1,
    category: 'utilities',
    auto_pay: false,
  });

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('recurring_bills')
        .select('*')
        .eq('user_id', user.id)
        .order('due_day', { ascending: true });

      if (error) throw error;
      setBills(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading bills:', error);
      setLoading(false);
    }
  };

  const addBill = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      if (!newBill.name || !newBill.provider) {
        alert('Please fill in bill name and provider');
        return;
      }

      const { error } = await supabase
        .from('recurring_bills')
        .insert([{
          ...newBill,
          user_id: user.id,
          created_at: new Date().toISOString(),
        }]);

      if (error) throw error;

      setNewBill({ name: '', provider: '', due_day: 1, category: 'utilities', auto_pay: false });
      setShowAddForm(false);
      loadBills();
    } catch (error) {
      console.error('Error adding bill:', error);
      alert('Failed to add bill');
    }
  };

  const toggleAutoPay = async (bill: Bill) => {
    try {
      const { error } = await supabase
        .from('recurring_bills')
        .update({ auto_pay: !bill.auto_pay })
        .eq('id', bill.id);

      if (error) throw error;
      loadBills();
    } catch (error) {
      console.error('Error updating bill:', error);
    }
  };

  const deleteBill = async (id: string) => {
    if (!confirm('Delete this bill?')) return;

    try {
      const { error } = await supabase
        .from('recurring_bills')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadBills();
    } catch (error) {
      console.error('Error deleting bill:', error);
      alert('Failed to delete bill');
    }
  };

  const getDaysUntilDue = (dueDay: number): number => {
    const today = new Date();
    const currentDay = today.getDate();

    if (dueDay >= currentDay) {
      return dueDay - currentDay;
    } else {
      // Next month
      const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      return (daysInMonth - currentDay) + dueDay;
    }
  };

  const getUrgencyColor = (daysUntil: number): string => {
    if (daysUntil <= 2) return 'from-red-500/20 to-rose-500/20 border-red-500/30';
    if (daysUntil <= 5) return 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30';
    return 'from-green-500/20 to-emerald-500/20 border-green-500/30';
  };

  const upcomingBills = bills.filter(b => getDaysUntilDue(b.due_day) <= 7);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Loading bills...</div>
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
          <h2 className="text-2xl font-bold text-white">📅 Bill Due Dates</h2>
          <p className="text-white/60 text-sm">Track and never miss a payment</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-300 font-medium transition-all"
        >
          {showAddForm ? '✕ Cancel' : '+ Add Bill'}
        </button>
      </div>

      {/* Upcoming Bills Alert */}
      {upcomingBills.length > 0 && (
        <div className="bg-gradient-to-r from-orange-500/20 to-yellow-500/20 backdrop-blur-xl rounded-2xl border border-orange-500/30 p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">⚠️</span>
            <h3 className="text-lg font-semibold text-white">Upcoming Bills (Next 7 Days)</h3>
          </div>
          <div className="space-y-2">
            {upcomingBills.map(bill => {
              const daysUntil = getDaysUntilDue(bill.due_day);
              return (
                <div key={bill.id} className="flex items-center justify-between bg-black/20 rounded-lg p-3">
                  <div>
                    <div className="font-medium text-white">{bill.name}</div>
                    <div className="text-sm text-white/60">{bill.provider}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${daysUntil <= 2 ? 'text-red-400' : 'text-yellow-400'}`}>
                      {daysUntil === 0 ? 'Due Today!' : daysUntil === 1 ? 'Due Tomorrow' : `${daysUntil} days`}
                    </div>
                    {bill.amount && <div className="text-sm text-white/70">${bill.amount.toFixed(2)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Bill Form */}
      {showAddForm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Add New Bill</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">Bill Name</label>
              <input
                type="text"
                value={newBill.name}
                onChange={(e) => setNewBill({ ...newBill, name: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                placeholder="Electric Bill"
              />
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-2">Provider</label>
              <input
                type="text"
                value={newBill.provider}
                onChange={(e) => setNewBill({ ...newBill, provider: e.target.value })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                placeholder="Power Company"
              />
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-2">Due Day of Month</label>
              <input
                type="number"
                min="1"
                max="31"
                value={newBill.due_day}
                onChange={(e) => setNewBill({ ...newBill, due_day: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
              />
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-2">Amount (optional)</label>
              <input
                type="number"
                step="0.01"
                value={newBill.amount || ''}
                onChange={(e) => setNewBill({ ...newBill, amount: parseFloat(e.target.value) || undefined })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                placeholder="$0.00"
              />
            </div>

            <div>
              <label className="block text-sm text-white/70 mb-2">Category</label>
              <select
                value={newBill.category}
                onChange={(e) => setNewBill({ ...newBill, category: e.target.value as any })}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat} className="bg-slate-800">
                    {CATEGORY_ICONS[cat]} {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="autopay"
                checked={newBill.auto_pay}
                onChange={(e) => setNewBill({ ...newBill, auto_pay: e.target.checked })}
                className="w-5 h-5 rounded bg-white/10 border-white/20 text-yellow-500 focus:ring-2 focus:ring-yellow-500/50"
              />
              <label htmlFor="autopay" className="text-white/80">Auto-pay enabled</label>
            </div>
          </div>

          <button
            onClick={addBill}
            className="mt-4 px-6 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-white font-semibold transition-all"
          >
            Add Bill
          </button>
        </motion.div>
      )}

      {/* Bills List */}
      <div className="space-y-3">
        {bills.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-12 text-center">
            <div className="text-white/40 text-lg mb-2">No bills tracked yet</div>
            <div className="text-white/60 text-sm">Click "Add Bill" to start tracking your bills</div>
          </div>
        ) : (
          bills.map((bill) => {
            const daysUntil = getDaysUntilDue(bill.due_day);
            const urgencyColor = getUrgencyColor(daysUntil);

            return (
              <div
                key={bill.id}
                className={`bg-gradient-to-r ${urgencyColor} backdrop-blur-xl rounded-2xl border p-5 hover:scale-[1.02] transition-all`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-3xl">{CATEGORY_ICONS[bill.category]}</div>
                      <div>
                        <div className="font-semibold text-white text-lg">{bill.name}</div>
                        <div className="text-sm text-white/70">{bill.provider}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <div className="text-xs text-white/50 mb-1">Due Date</div>
                        <div className="text-white font-medium">Day {bill.due_day}</div>
                      </div>
                      <div>
                        <div className="text-xs text-white/50 mb-1">Days Until Due</div>
                        <div className={`font-semibold ${daysUntil <= 2 ? 'text-red-300' : daysUntil <= 5 ? 'text-yellow-300' : 'text-green-300'}`}>
                          {daysUntil === 0 ? 'Today!' : `${daysUntil} days`}
                        </div>
                      </div>
                      {bill.amount && (
                        <div>
                          <div className="text-xs text-white/50 mb-1">Amount</div>
                          <div className="text-white font-medium">${bill.amount.toFixed(2)}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-xs text-white/50 mb-1">Payment</div>
                        <button
                          onClick={() => toggleAutoPay(bill)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                            bill.auto_pay
                              ? 'bg-green-500/30 border border-green-500/50 text-green-300'
                              : 'bg-white/10 border border-white/20 text-white/60'
                          }`}
                        >
                          {bill.auto_pay ? '✓ Auto-pay' : 'Manual'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteBill(bill.id!)}
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
