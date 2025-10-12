import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface RecurringBill {
  id?: string;
  user_id?: string;
  name: string;
  amount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'custom';
  day_of_week?: number; // 0=Sunday, 1=Monday, etc. (for weekly)
  day_of_month?: number; // 1-31 (for monthly)
  skip_first_week?: boolean; // For rent: skip 1st Friday
  is_active: boolean;
  color?: string;
  icon?: string;
  created_at?: string;
}

interface BillPayment {
  id?: string;
  user_id?: string;
  recurring_bill_id: string;
  date: string;
  amount: number;
  paid: boolean;
  paid_at?: string;
}

interface CalendarDay {
  date: Date;
  dateString: string;
  isCurrentMonth: boolean;
  bills: {
    bill: RecurringBill;
    payment?: BillPayment;
  }[];
}

export function BillsCalendar() {
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [showAddBill, setShowAddBill] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formFrequency, setFormFrequency] = useState<'weekly' | 'monthly'>('monthly');
  const [formDayOfWeek, setFormDayOfWeek] = useState(5); // Friday
  const [formDayOfMonth, setFormDayOfMonth] = useState(1);
  const [formSkipFirstWeek, setFormSkipFirstWeek] = useState(false);
  const [formIcon, setFormIcon] = useState('💵');

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  const loadData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Load recurring bills
      const { data: billsData, error: billsError } = await supabase
        .from('recurring_bills')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (billsError) throw billsError;
      setRecurringBills(billsData || []);

      // Load payments for current month
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).toISOString().split('T')[0];
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).toISOString().split('T')[0];

      const { data: paymentsData, error: paymentsError } = await supabase
        .from('bill_payments')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      if (paymentsError) throw paymentsError;
      setPayments(paymentsData || []);

      setLoading(false);
    } catch (error) {
      console.error('Error loading bills:', error);
      setLoading(false);
    }
  };

  const addRecurringBill = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      if (!formName.trim() || !formAmount || parseFloat(formAmount) <= 0) {
        alert('Please fill in bill name and amount');
        return;
      }

      const { error } = await supabase
        .from('recurring_bills')
        .insert({
          user_id: user.id,
          name: formName.trim(),
          amount: parseFloat(formAmount),
          frequency: formFrequency,
          day_of_week: formFrequency === 'weekly' ? formDayOfWeek : null,
          day_of_month: formFrequency === 'monthly' ? formDayOfMonth : null,
          skip_first_week: formSkipFirstWeek,
          is_active: true,
          icon: formIcon,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Reset form
      setFormName('');
      setFormAmount('');
      setFormFrequency('monthly');
      setFormDayOfWeek(5);
      setFormDayOfMonth(1);
      setFormSkipFirstWeek(false);
      setFormIcon('💵');
      setShowAddBill(false);
      loadData();
    } catch (error) {
      console.error('Error adding bill:', error);
      alert('Failed to add bill');
    }
  };

  const togglePayment = async (day: CalendarDay, bill: RecurringBill) => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      const existingPayment = payments.find(
        p => p.recurring_bill_id === bill.id && p.date === day.dateString
      );

      if (existingPayment) {
        // Toggle paid status
        const { error } = await supabase
          .from('bill_payments')
          .update({
            paid: !existingPayment.paid,
            paid_at: !existingPayment.paid ? new Date().toISOString() : null,
          })
          .eq('id', existingPayment.id);

        if (error) throw error;
      } else {
        // Create new payment record (marked as paid)
        const { error } = await supabase
          .from('bill_payments')
          .insert({
            user_id: user.id,
            recurring_bill_id: bill.id,
            date: day.dateString,
            amount: bill.amount,
            paid: true,
            paid_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      loadData();
    } catch (error) {
      console.error('Error toggling payment:', error);
    }
  };

  const deleteBill = async (bill: RecurringBill) => {
    if (!confirm(`Delete "${bill.name}"? This will remove all payment history.`)) return;

    try {
      const { error } = await supabase
        .from('recurring_bills')
        .update({ is_active: false })
        .eq('id', bill.id);

      if (error) throw error;
      loadData();
    } catch (error) {
      console.error('Error deleting bill:', error);
      alert('Failed to delete bill');
    }
  };

  // Generate calendar days
  const generateCalendar = (): CalendarDay[] => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Go back to Sunday

    const days: CalendarDay[] = [];
    const currentDate = new Date(startDate);

    // Generate 6 weeks (42 days)
    for (let i = 0; i < 42; i++) {
      const dateString = currentDate.toISOString().split('T')[0];
      const isCurrentMonth = currentDate.getMonth() === month;

      // Find bills due on this day
      const billsForDay = recurringBills
        .filter(bill => billDueOnDate(bill, currentDate))
        .map(bill => ({
          bill,
          payment: payments.find(p => p.recurring_bill_id === bill.id && p.date === dateString),
        }));

      days.push({
        date: new Date(currentDate),
        dateString,
        isCurrentMonth,
        bills: billsForDay,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return days;
  };

  const billDueOnDate = (bill: RecurringBill, date: Date): boolean => {
    if (bill.frequency === 'weekly') {
      if (date.getDay() !== bill.day_of_week) return false;

      // Check skip_first_week for rent
      if (bill.skip_first_week) {
        const dateNum = date.getDate();
        // Skip if it's the 1st-7th (first week)
        if (dateNum <= 7) return false;
      }
      return true;
    }

    if (bill.frequency === 'monthly') {
      return date.getDate() === bill.day_of_month;
    }

    return false;
  };

  const calendar = generateCalendar();

  // Calculate this week's load (Friday to Thursday)
  const today = new Date();
  const thisWeekStart = new Date(today);
  const daysSinceFriday = (today.getDay() + 2) % 7; // Days since last Friday
  thisWeekStart.setDate(today.getDate() - daysSinceFriday);
  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekStart.getDate() + 6);

  const thisWeekBills = calendar.filter(day =>
    day.date >= thisWeekStart && day.date <= thisWeekEnd
  ).flatMap(day => day.bills.filter(b => !b.payment?.paid));

  const thisWeekTotal = thisWeekBills.reduce((sum, b) => sum + b.bill.amount, 0);

  // Calculate month remaining (unpaid bills)
  const monthRemaining = calendar
    .filter(day => day.isCurrentMonth && day.date >= today)
    .flatMap(day => day.bills.filter(b => !b.payment?.paid))
    .reduce((sum, b) => sum + b.bill.amount, 0);

  // Calculate total for month
  const monthTotal = calendar
    .filter(day => day.isCurrentMonth)
    .flatMap(day => day.bills)
    .reduce((sum, b) => sum + b.bill.amount, 0);

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
          <h2 className="text-3xl font-bold text-white">💰 Bills & Payments</h2>
          <p className="text-white/60 text-sm">Track all your recurring payments</p>
        </div>
        <button
          onClick={() => setShowAddBill(!showAddBill)}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/20 hover:from-yellow-500/30 hover:to-orange-500/30 border border-yellow-500/30 text-yellow-300 font-medium transition-all"
        >
          {showAddBill ? '✕ Cancel' : '+ Add Bill'}
        </button>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-r from-red-500/20 to-rose-500/20 backdrop-blur-xl rounded-2xl border border-red-500/30 p-5">
          <div className="text-white/70 text-sm mb-1">This Week's Load</div>
          <div className="text-white text-3xl font-bold">${thisWeekTotal.toFixed(2)}</div>
          <div className="text-white/60 text-xs mt-1">{thisWeekBills.length} bills due</div>
        </div>
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 backdrop-blur-xl rounded-2xl border border-yellow-500/30 p-5">
          <div className="text-white/70 text-sm mb-1">Month Remaining</div>
          <div className="text-white text-3xl font-bold">${monthRemaining.toFixed(2)}</div>
          <div className="text-white/60 text-xs mt-1">Unpaid bills</div>
        </div>
        <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 backdrop-blur-xl rounded-2xl border border-green-500/30 p-5">
          <div className="text-white/70 text-sm mb-1">This Month Total</div>
          <div className="text-white text-3xl font-bold">${monthTotal.toFixed(2)}</div>
          <div className="text-white/60 text-xs mt-1">All bills</div>
        </div>
      </div>

      {/* Add Bill Form */}
      {showAddBill && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Add Recurring Bill</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">Bill Name</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Rent, Internet, Insurance"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Amount</label>
              <input
                type="number"
                step="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Frequency</label>
              <select
                value={formFrequency}
                onChange={(e) => setFormFrequency(e.target.value as 'weekly' | 'monthly')}
                className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
              >
                <option value="weekly" className="bg-slate-800">Weekly</option>
                <option value="monthly" className="bg-slate-800">Monthly</option>
              </select>
            </div>
            {formFrequency === 'weekly' ? (
              <div>
                <label className="block text-sm text-white/70 mb-2">Day of Week</label>
                <select
                  value={formDayOfWeek}
                  onChange={(e) => setFormDayOfWeek(parseInt(e.target.value))}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
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
            ) : (
              <div>
                <label className="block text-sm text-white/70 mb-2">Day of Month</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formDayOfMonth}
                  onChange={(e) => setFormDayOfMonth(parseInt(e.target.value) || 1)}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
                />
              </div>
            )}
            {formFrequency === 'weekly' && (
              <div className="md:col-span-2 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="skipFirstWeek"
                  checked={formSkipFirstWeek}
                  onChange={(e) => setFormSkipFirstWeek(e.target.checked)}
                  className="w-5 h-5 rounded bg-white/10 border-white/20 text-yellow-500 focus:ring-2 focus:ring-yellow-500/50"
                />
                <label htmlFor="skipFirstWeek" className="text-white/80">
                  Skip first week of month (for Rent)
                </label>
              </div>
            )}
          </div>
          <button
            onClick={addRecurringBill}
            className="mt-4 px-6 py-2 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold transition-all"
          >
            Add Bill
          </button>
        </motion.div>
      )}

      {/* Month Navigation */}
      <div className="flex items-center justify-between bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 p-4">
        <button
          onClick={() => {
            const newMonth = new Date(currentMonth);
            newMonth.setMonth(newMonth.getMonth() - 1);
            setCurrentMonth(newMonth);
          }}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
        >
          ← Previous
        </button>
        <div className="text-white font-bold text-xl">
          {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
        <button
          onClick={() => {
            const newMonth = new Date(currentMonth);
            newMonth.setMonth(newMonth.getMonth() + 1);
            setCurrentMonth(newMonth);
          }}
          className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all"
        >
          Next →
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-2 mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-white/70 font-semibold text-sm">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        <div className="grid grid-cols-7 gap-2">
          {calendar.map((day, index) => {
            const isToday = day.dateString === new Date().toISOString().split('T')[0];
            const totalDue = day.bills.reduce((sum, b) => sum + b.bill.amount, 0);
            const allPaid = day.bills.length > 0 && day.bills.every(b => b.payment?.paid);
            const somePaid = day.bills.some(b => b.payment?.paid);

            return (
              <div
                key={index}
                className={`min-h-[100px] p-2 rounded-lg border transition-all ${
                  !day.isCurrentMonth
                    ? 'bg-white/5 border-white/5 opacity-40'
                    : isToday
                    ? 'bg-blue-500/20 border-blue-500/50 ring-2 ring-blue-500/30'
                    : allPaid
                    ? 'bg-green-500/10 border-green-500/30'
                    : day.bills.length > 0
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="text-white/80 text-sm font-semibold mb-1">
                  {day.date.getDate()}
                </div>
                {day.bills.length > 0 && (
                  <div className="space-y-1">
                    {day.bills.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => togglePayment(day, item.bill)}
                        className={`w-full text-left px-2 py-1 rounded text-xs transition-all ${
                          item.payment?.paid
                            ? 'bg-green-500/30 border border-green-500/50 text-green-200 line-through'
                            : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">{item.bill.icon} {item.bill.name}</span>
                          <span className="text-xs ml-1">${item.bill.amount}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recurring Bills Management */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
        <h3 className="text-xl font-bold text-white mb-4">Recurring Bills</h3>
        {recurringBills.length === 0 ? (
          <div className="text-center py-8 text-white/40">
            No recurring bills added yet
          </div>
        ) : (
          <div className="space-y-2">
            {recurringBills.map(bill => (
              <div
                key={bill.id}
                className="flex items-center justify-between bg-white/5 rounded-lg p-4 hover:bg-white/10 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{bill.icon}</div>
                  <div>
                    <div className="font-semibold text-white">{bill.name}</div>
                    <div className="text-sm text-white/60">
                      ${bill.amount.toFixed(2)} • {bill.frequency}
                      {bill.frequency === 'weekly' && ` on ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][bill.day_of_week!]}`}
                      {bill.frequency === 'monthly' && ` on day ${bill.day_of_month}`}
                      {bill.skip_first_week && ' (skip 1st week)'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteBill(bill)}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm transition-all"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
