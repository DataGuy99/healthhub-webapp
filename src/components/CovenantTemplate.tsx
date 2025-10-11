import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase, CategoryItem, CategoryLog } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface CovenantTemplateProps {
  category: string;
  categoryName: string;
  icon: string;
  color: string;
  onBack: () => void;
}

export function CovenantTemplate({ category, categoryName, icon, color, onBack }: CovenantTemplateProps) {
  const [obligations, setObligations] = useState<CategoryItem[]>([]);
  const [payments, setPayments] = useState<Map<string, CategoryLog[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showAddObligation, setShowAddObligation] = useState(false);
  const [newObligationName, setNewObligationName] = useState('');
  const [newObligationAmount, setNewObligationAmount] = useState('');
  const [newObligationDueDay, setNewObligationDueDay] = useState('1');
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Load obligations (recurring bills)
      const { data: obligationsData, error: obligationsError } = await supabase
        .from('category_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('category', category)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (obligationsError) throw obligationsError;
      setObligations(obligationsData || []);

      // Load payment history for current month
      const startDate = `${currentMonth}-01`;
      const endDate = `${currentMonth}-31`;

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('category_logs')
        .select('*, category_items!inner(category)')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('category_items.category', category);

      if (paymentsError) throw paymentsError;

      // Group payments by obligation ID
      const paymentsMap = new Map<string, CategoryLog[]>();
      paymentsData?.forEach((payment: any) => {
        const itemId = payment.category_item_id;
        if (!paymentsMap.has(itemId)) {
          paymentsMap.set(itemId, []);
        }
        paymentsMap.get(itemId)!.push(payment);
      });
      setPayments(paymentsMap);

      setLoading(false);
    } catch (error) {
      console.error('Error loading covenant data:', error);
      setLoading(false);
    }
  };

  const addObligation = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      if (!newObligationName.trim()) {
        alert('Please enter an obligation name');
        return;
      }

      if (!newObligationAmount || parseFloat(newObligationAmount) <= 0) {
        alert('Please enter a valid amount');
        return;
      }

      const { error } = await supabase
        .from('category_items')
        .insert({
          user_id: user.id,
          category: category,
          name: newObligationName.trim(),
          amount: parseFloat(newObligationAmount),
          frequency: 'monthly',
          description: `Due on day ${newObligationDueDay} of each month`,
          subcategory: newObligationDueDay, // Store due day in subcategory field
          is_active: true
        });

      if (error) throw error;

      setNewObligationName('');
      setNewObligationAmount('');
      setNewObligationDueDay('1');
      setShowAddObligation(false);
      loadData();
    } catch (error) {
      console.error('Error adding obligation:', error);
      alert('Failed to add obligation');
    }
  };

  const markAsPaid = async (obligationId: string, amount?: number) => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase
        .from('category_logs')
        .upsert({
          user_id: user.id,
          category_item_id: obligationId,
          date: today,
          actual_amount: amount,
          is_planned: true,
          timestamp: new Date().toISOString()
        }, { onConflict: 'user_id,category_item_id,date' });

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error marking as paid:', error);
      alert('Failed to mark as paid');
    }
  };

  const deleteObligation = async (obligationId: string) => {
    if (!confirm('Are you sure you want to delete this obligation?')) return;

    try {
      const { error } = await supabase
        .from('category_items')
        .update({ is_active: false })
        .eq('id', obligationId);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting obligation:', error);
      alert('Failed to delete obligation');
    }
  };

  const calculateAverageAmount = (obligationId: string): number => {
    const obligationPayments = payments.get(obligationId) || [];
    if (obligationPayments.length === 0) return 0;

    const validPayments = obligationPayments.filter(p => p.actual_amount);
    if (validPayments.length === 0) return 0;

    const total = validPayments.reduce((sum, p) => sum + (p.actual_amount || 0), 0);
    return total / validPayments.length;
  };

  const isPaidThisMonth = (obligationId: string): boolean => {
    return (payments.get(obligationId) || []).length > 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-white/70">Loading {categoryName}...</div>
      </div>
    );
  }

  const totalExpected = obligations.reduce((sum, o) => sum + (o.amount || 0), 0);
  const totalPaid = Array.from(payments.values())
    .flat()
    .reduce((sum, p) => sum + (p.actual_amount || 0), 0);
  const paidCount = obligations.filter(o => isPaidThisMonth(o.id!)).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
          >
            ← Back
          </button>
          <span className="text-4xl">{icon}</span>
          <div>
            <h1 className="text-2xl font-bold text-white">{categoryName}</h1>
            <p className="text-white/60 text-sm">
              {paidCount} / {obligations.length} paid this month
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Month Navigation */}
          <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => {
                const date = new Date(currentMonth + '-01');
                date.setMonth(date.getMonth() - 1);
                setCurrentMonth(date.toISOString().slice(0, 7));
              }}
              className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-sm transition-all"
            >
              ←
            </button>
            <span className="px-3 text-white font-medium">
              {new Date(currentMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button
              onClick={() => {
                const date = new Date(currentMonth + '-01');
                date.setMonth(date.getMonth() + 1);
                setCurrentMonth(date.toISOString().slice(0, 7));
              }}
              className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-sm transition-all"
            >
              →
            </button>
          </div>

          <button
            onClick={() => setShowAddObligation(!showAddObligation)}
            className="px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 font-medium transition-all"
          >
            + Add Obligation
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-white/60 text-sm font-medium mb-2">Expected This Month</h3>
          <p className="text-3xl font-bold text-white">${totalExpected.toFixed(2)}</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-white/60 text-sm font-medium mb-2">Paid So Far</h3>
          <p className="text-3xl font-bold text-green-400">${totalPaid.toFixed(2)}</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <h3 className="text-white/60 text-sm font-medium mb-2">Remaining</h3>
          <p className="text-3xl font-bold text-orange-400">${(totalExpected - totalPaid).toFixed(2)}</p>
        </div>
      </div>

      {/* Add Obligation Form */}
      {showAddObligation && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Add New Obligation</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Obligation name (e.g., Rent, Electric)"
              value={newObligationName}
              onChange={(e) => setNewObligationName(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <input
              type="number"
              placeholder="Amount"
              value={newObligationAmount}
              onChange={(e) => setNewObligationAmount(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            />
            <select
              value={newObligationDueDay}
              onChange={(e) => setNewObligationDueDay(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>Due on day {day}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={addObligation}
              className="px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 font-medium transition-all"
            >
              Add Obligation
            </button>
            <button
              onClick={() => setShowAddObligation(false)}
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white/80 transition-all"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Obligations List */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Monthly Obligations</h2>

        {obligations.length === 0 ? (
          <div className="text-center py-12 text-white/60">
            No obligations yet. Click "Add Obligation" to get started.
          </div>
        ) : (
          <div className="space-y-3">
            {obligations.map((obligation) => {
              const isPaid = isPaidThisMonth(obligation.id!);
              const dueDay = obligation.subcategory || '1';
              const avgAmount = calculateAverageAmount(obligation.id!);

              return (
                <div
                  key={obligation.id}
                  className={`p-5 rounded-xl border transition-all ${
                    isPaid
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{obligation.name}</h3>
                        {isPaid && (
                          <span className="px-2 py-1 bg-green-500/20 border border-green-500/30 rounded text-green-300 text-xs font-medium">
                            ✓ Paid
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-white/60">
                        <span>Expected: ${obligation.amount?.toFixed(2) || '0.00'}</span>
                        <span>•</span>
                        <span>Due: Day {dueDay}</span>
                        {avgAmount > 0 && (
                          <>
                            <span>•</span>
                            <span>Avg: ${avgAmount.toFixed(2)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isPaid && (
                        <button
                          onClick={() => markAsPaid(obligation.id!, obligation.amount)}
                          className="px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-300 font-medium transition-all"
                        >
                          Mark as Paid
                        </button>
                      )}
                      <button
                        onClick={() => deleteObligation(obligation.id!)}
                        className="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
