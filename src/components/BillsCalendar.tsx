import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

// Phase 6.2: Updated interface to match new schema
interface RecurringBill {
  id?: string;
  user_id?: string;
  name: string;
  amount: number;
  // New Phase 6.2 fields
  recurrence_type: 'monthly' | 'weekly' | 'biweekly' | 'custom';
  recurrence_config?: {
    day_of_week?: number; // 0=Sunday through 6=Saturday
    exclude_week_numbers?: number[]; // e.g., [1] to exclude first week
    days_of_month?: number[]; // e.g., [1, 15] for 1st and 15th
    interval_weeks?: number; // For custom biweekly patterns
    start_date?: string; // For custom patterns
  };
  provider?: string; // Auto-populated from name
  is_income: boolean; // Track income vs expenses
  is_active: boolean;
  color?: string;
  icon?: string;
  created_at?: string;
}

interface BillPayment {
  id?: string;
  user_id?: string;
  recurring_bill_id: string;
  bill_id?: string; // Backward compatibility
  date: string;
  amount: number;
  paid?: boolean; // Optional for backward compatibility
  notes?: string;
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

// Helper function to extract provider name from bill name
const extractProvider = (billName: string): string => {
  // Common patterns: "Netflix Subscription" -> "Netflix", "PG&E Bill" -> "PG&E"
  const commonSuffixes = [' subscription', ' bill', ' payment', ' service', ' plan', ' membership'];
  let provider = billName.trim();

  for (const suffix of commonSuffixes) {
    if (provider.toLowerCase().endsWith(suffix)) {
      provider = provider.slice(0, -suffix.length).trim();
      break;
    }
  }

  return provider;
};

export function BillsCalendar() {
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [showAddBill, setShowAddBill] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showIncome, setShowIncome] = useState(false); // Toggle income/expense view

  // Form state - Phase 6.2 enhanced
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formRecurrenceType, setFormRecurrenceType] = useState<'monthly' | 'weekly' | 'biweekly' | 'custom'>('monthly');
  const [formDayOfWeek, setFormDayOfWeek] = useState(5); // Friday default
  const [formDayOfMonth, setFormDayOfMonth] = useState(1);
  const [formDaysOfMonth, setFormDaysOfMonth] = useState<number[]>([1]); // For multiple days
  const [formExcludeWeeks, setFormExcludeWeeks] = useState<number[]>([]); // e.g., [1] for skip first week
  const [formProvider, setFormProvider] = useState('');
  const [formIsIncome, setFormIsIncome] = useState(false);
  const [formIcon, setFormIcon] = useState('💵');

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  // Auto-populate provider when name changes
  useEffect(() => {
    if (formName && !formProvider) {
      setFormProvider(extractProvider(formName));
    }
  }, [formName]);

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

  const handleDateClick = (day: CalendarDay) => {
    setSelectedDate(day.date);
    setShowAddBill(true);

    // Pre-populate form based on clicked date
    if (formRecurrenceType === 'weekly' || formRecurrenceType === 'biweekly') {
      setFormDayOfWeek(day.date.getDay());
    } else if (formRecurrenceType === 'monthly') {
      setFormDayOfMonth(day.date.getDate());
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

      // Build recurrence_config based on recurrence_type
      let recurrence_config: RecurringBill['recurrence_config'] = {};

      if (formRecurrenceType === 'weekly' || formRecurrenceType === 'biweekly') {
        recurrence_config.day_of_week = formDayOfWeek;
        if (formExcludeWeeks.length > 0) {
          recurrence_config.exclude_week_numbers = formExcludeWeeks;
        }
      } else if (formRecurrenceType === 'monthly') {
        if (formDaysOfMonth.length > 1) {
          recurrence_config.days_of_month = formDaysOfMonth;
        } else {
          recurrence_config.days_of_month = [formDayOfMonth];
        }
      }

      const { error } = await supabase
        .from('recurring_bills')
        .insert({
          user_id: user.id,
          name: formName.trim(),
          amount: parseFloat(formAmount),
          recurrence_type: formRecurrenceType,
          recurrence_config: Object.keys(recurrence_config).length > 0 ? recurrence_config : null,
          provider: formProvider.trim() || extractProvider(formName),
          is_income: formIsIncome,
          is_active: true,
          icon: formIcon,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;

      // Reset form
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error adding bill:', error);
      alert('Failed to add bill');
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormAmount('');
    setFormRecurrenceType('monthly');
    setFormDayOfWeek(5);
    setFormDayOfMonth(1);
    setFormDaysOfMonth([1]);
    setFormExcludeWeeks([]);
    setFormProvider('');
    setFormIsIncome(false);
    setFormIcon('💵');
    setShowAddBill(false);
    setSelectedDate(null);
  };

  const togglePayment = async (day: CalendarDay, bill: RecurringBill) => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Check both recurring_bill_id and bill_id for backward compatibility
      const existingPayment = payments.find(
        p => (p.recurring_bill_id === bill.id || p.bill_id === bill.id) && p.date === day.dateString
      );

      if (existingPayment) {
        // Toggle paid status (or delete if exists)
        const { error } = await supabase
          .from('bill_payments')
          .delete()
          .eq('id', existingPayment.id);

        if (error) throw error;
      } else {
        // Create new payment record (marked as paid)
        const { error } = await supabase
          .from('bill_payments')
          .insert({
            user_id: user.id,
            recurring_bill_id: bill.id,
            bill_id: bill.id, // Backward compatibility
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
    if (!confirm(`Delete "${bill.name}"? This will mark it as inactive.`)) return;

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

  // Phase 6.2: Enhanced bill due date logic using new schema
  const billDueOnDate = (bill: RecurringBill, date: Date): boolean => {
    const config = bill.recurrence_config || {};

    if (bill.recurrence_type === 'weekly') {
      if (date.getDay() !== config.day_of_week) return false;

      // Check exclude_week_numbers (e.g., skip first week)
      if (config.exclude_week_numbers && config.exclude_week_numbers.length > 0) {
        const dateNum = date.getDate();
        const weekOfMonth = Math.ceil(dateNum / 7);
        if (config.exclude_week_numbers.includes(weekOfMonth)) {
          return false;
        }
      }
      return true;
    }

    if (bill.recurrence_type === 'biweekly') {
      if (date.getDay() !== config.day_of_week) return false;

      const dateNum = date.getDate();
      const weekOfMonth = Math.ceil(dateNum / 7);

      // Check exclude_week_numbers
      if (config.exclude_week_numbers && config.exclude_week_numbers.length > 0) {
        if (config.exclude_week_numbers.includes(weekOfMonth)) {
          return false;
        }
      }

      // Default biweekly: alternate weeks (1st and 3rd week)
      return weekOfMonth === 1 || weekOfMonth === 3;
    }

    if (bill.recurrence_type === 'monthly') {
      // Support multiple days of month (e.g., 1st and 15th)
      if (config.days_of_month && config.days_of_month.length > 0) {
        return config.days_of_month.includes(date.getDate());
      }
      return false;
    }

    return false;
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
          payment: payments.find(p =>
            (p.recurring_bill_id === bill.id || p.bill_id === bill.id) && p.date === dateString
          ),
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

  const calendar = generateCalendar();

  // Filter bills for calculations
  const activeBills = showIncome
    ? recurringBills.filter(b => b.is_income)
    : recurringBills.filter(b => !b.is_income);

  // Calculate this week's load (Friday to Thursday)
  const today = new Date();
  const thisWeekStart = new Date(today);
  const daysSinceFriday = (today.getDay() + 2) % 7;
  thisWeekStart.setDate(today.getDate() - daysSinceFriday);
  const thisWeekEnd = new Date(thisWeekStart);
  thisWeekEnd.setDate(thisWeekStart.getDate() + 6);

  const thisWeekBills = calendar.filter(day =>
    day.date >= thisWeekStart && day.date <= thisWeekEnd
  ).flatMap(day => day.bills.filter(b =>
    !b.payment?.paid &&
    (showIncome ? b.bill.is_income : !b.bill.is_income)
  ));

  const thisWeekTotal = thisWeekBills.reduce((sum, b) => sum + b.bill.amount, 0);

  // Calculate month remaining (unpaid bills)
  const monthRemaining = calendar
    .filter(day => day.isCurrentMonth && day.date >= today)
    .flatMap(day => day.bills.filter(b =>
      !b.payment?.paid &&
      (showIncome ? b.bill.is_income : !b.bill.is_income)
    ))
    .reduce((sum, b) => sum + b.bill.amount, 0);

  // Calculate total for month
  const monthTotal = calendar
    .filter(day => day.isCurrentMonth)
    .flatMap(day => day.bills.filter(b =>
      showIncome ? b.bill.is_income : !b.bill.is_income
    ))
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
          <h2 className="text-3xl font-bold text-white">
            💰 Bills & Payments {showIncome && '(Income)'}
          </h2>
          <p className="text-white/60 text-sm">Track all your recurring {showIncome ? 'income' : 'payments'}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowIncome(!showIncome)}
            className={`px-4 py-2 rounded-lg border font-medium transition-all ${
              showIncome
                ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-300'
                : 'bg-gradient-to-r from-red-500/20 to-rose-500/20 border-red-500/30 text-red-300'
            }`}
          >
            {showIncome ? '💵 Income' : '💳 Expenses'}
          </button>
          <button
            onClick={() => setShowAddBill(!showAddBill)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/20 hover:from-yellow-500/30 hover:to-orange-500/30 border border-yellow-500/30 text-yellow-300 font-medium transition-all"
          >
            {showAddBill ? '✕ Cancel' : `+ Add ${showIncome ? 'Income' : 'Bill'}`}
          </button>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`bg-gradient-to-r ${showIncome ? 'from-green-500/20 to-emerald-500/20 border-green-500/30' : 'from-red-500/20 to-rose-500/20 border-red-500/30'} backdrop-blur-xl rounded-2xl border p-5`}>
          <div className="text-white/70 text-sm mb-1">This Week</div>
          <div className="text-white text-3xl font-bold">${thisWeekTotal.toFixed(2)}</div>
          <div className="text-white/60 text-sm mt-1">{thisWeekBills.length} pending</div>
        </div>
        <div className={`bg-gradient-to-r ${showIncome ? 'from-blue-500/20 to-cyan-500/20 border-blue-500/30' : 'from-orange-500/20 to-amber-500/20 border-orange-500/30'} backdrop-blur-xl rounded-2xl border p-5`}>
          <div className="text-white/70 text-sm mb-1">Month Remaining</div>
          <div className="text-white text-3xl font-bold">${monthRemaining.toFixed(2)}</div>
          <div className="text-white/60 text-sm mt-1">Unpaid {showIncome ? 'income' : 'bills'}</div>
        </div>
        <div className={`bg-gradient-to-r ${showIncome ? 'from-purple-500/20 to-pink-500/20 border-purple-500/30' : 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30'} backdrop-blur-xl rounded-2xl border p-5`}>
          <div className="text-white/70 text-sm mb-1">Month Total</div>
          <div className="text-white text-3xl font-bold">${monthTotal.toFixed(2)}</div>
          <div className="text-white/60 text-sm mt-1">Total {showIncome ? 'income' : 'expenses'}</div>
        </div>
      </div>

      {/* Add Bill Form */}
      {showAddBill && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 backdrop-blur-xl rounded-2xl border border-yellow-500/20 p-6"
        >
          <h3 className="text-xl font-bold text-white mb-4">Add {formIsIncome ? 'Income' : 'Bill'}</h3>

          {/* Income Toggle */}
          <div className="mb-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsIncome}
                onChange={(e) => {
                  setFormIsIncome(e.target.checked);
                  setFormIcon(e.target.checked ? '💵' : '💳');
                }}
                className="w-5 h-5 rounded border-white/20 bg-white/5 text-green-500 focus:ring-green-500/50"
              />
              <span className="text-white/80">This is income (not an expense)</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-white/80 text-sm mb-2">Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Netflix Subscription"
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-yellow-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-white/80 text-sm mb-2">Provider (auto-filled)</label>
              <input
                type="text"
                value={formProvider}
                onChange={(e) => setFormProvider(e.target.value)}
                placeholder="Netflix"
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-yellow-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-white/80 text-sm mb-2">Amount ($) *</label>
              <input
                type="number"
                step="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="12.99"
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-yellow-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-white/80 text-sm mb-2">Icon</label>
              <input
                type="text"
                value={formIcon}
                onChange={(e) => setFormIcon(e.target.value)}
                placeholder="💵"
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-yellow-500/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Recurrence Configuration */}
          <div className="space-y-4 mb-4">
            <div>
              <label className="block text-white/80 text-sm mb-2">Recurrence Type</label>
              <select
                value={formRecurrenceType}
                onChange={(e) => setFormRecurrenceType(e.target.value as any)}
                className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-yellow-500/50 focus:outline-none"
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {formRecurrenceType === 'monthly' && (
              <div>
                <label className="block text-white/80 text-sm mb-2">Day of Month</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formDayOfMonth}
                  onChange={(e) => setFormDayOfMonth(parseInt(e.target.value))}
                  className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-yellow-500/50 focus:outline-none"
                />
                <p className="text-white/50 text-xs mt-1">
                  For multiple days (e.g., 1st and 15th), use comma: 1,15
                </p>
              </div>
            )}

            {(formRecurrenceType === 'weekly' || formRecurrenceType === 'biweekly') && (
              <>
                <div>
                  <label className="block text-white/80 text-sm mb-2">Day of Week</label>
                  <select
                    value={formDayOfWeek}
                    onChange={(e) => setFormDayOfWeek(parseInt(e.target.value))}
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white focus:border-yellow-500/50 focus:outline-none"
                  >
                    <option value={0}>Sunday</option>
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formExcludeWeeks.includes(1)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormExcludeWeeks([1]);
                        } else {
                          setFormExcludeWeeks([]);
                        }
                      }}
                      className="w-5 h-5 rounded border-white/20 bg-white/5 text-yellow-500 focus:ring-yellow-500/50"
                    />
                    <span className="text-white/80">Skip first week of month (e.g., rent pattern)</span>
                  </label>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={addRecurringBill}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-medium hover:shadow-lg hover:shadow-yellow-500/50 transition-all"
            >
              Add {formIsIncome ? 'Income' : 'Bill'}
            </button>
            <button
              onClick={resetForm}
              className="px-6 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {/* Calendar */}
      <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-xl rounded-2xl border border-purple-500/20 p-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all"
          >
            ← Prev
          </button>
          <h3 className="text-2xl font-bold text-white">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all"
          >
            Next →
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-white/70 font-medium text-sm py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {calendar.map((day, idx) => {
            const isToday = day.dateString === new Date().toISOString().split('T')[0];
            const visibleBills = day.bills.filter(b =>
              showIncome ? b.bill.is_income : !b.bill.is_income
            );

            return (
              <div
                key={idx}
                onClick={() => handleDateClick(day)}
                className={`min-h-[100px] p-2 rounded-lg border transition-all cursor-pointer ${
                  day.isCurrentMonth
                    ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                    : 'bg-white/[0.02] border-white/5 text-white/40'
                } ${isToday ? 'ring-2 ring-purple-500/50' : ''}`}
              >
                <div className={`text-sm font-medium mb-1 ${isToday ? 'text-purple-400' : 'text-white/80'}`}>
                  {day.date.getDate()}
                </div>
                <div className="space-y-1">
                  {visibleBills.map((billItem, billIdx) => (
                    <div
                      key={billIdx}
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePayment(day, billItem.bill);
                      }}
                      className={`text-xs px-2 py-1 rounded cursor-pointer transition-all ${
                        billItem.payment?.paid
                          ? 'bg-green-500/20 text-green-300 border border-green-500/30 line-through'
                          : billItem.bill.is_income
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30'
                          : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 hover:bg-yellow-500/30'
                      }`}
                      title={`${billItem.bill.name} - $${billItem.bill.amount.toFixed(2)}${billItem.bill.provider ? ` (${billItem.bill.provider})` : ''}`}
                    >
                      <div className="flex items-center gap-1">
                        <span>{billItem.bill.icon || '💵'}</span>
                        <span className="truncate flex-1">{billItem.bill.name}</span>
                        <span className="font-bold">${billItem.bill.amount.toFixed(0)}</span>
                      </div>
                      {billItem.bill.provider && (
                        <div className="text-[10px] text-white/50 truncate mt-0.5">
                          {billItem.bill.provider}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Bills List */}
      {activeBills.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 backdrop-blur-xl rounded-2xl border border-indigo-500/20 p-6">
          <h3 className="text-xl font-bold text-white mb-4">
            Active {showIncome ? 'Income Sources' : 'Bills'} ({activeBills.length})
          </h3>
          <div className="space-y-2">
            {activeBills
              .sort((a, b) => b.amount - a.amount)
              .map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{bill.icon || '💵'}</span>
                    <div>
                      <div className="text-white font-medium">{bill.name}</div>
                      <div className="text-white/50 text-sm">
                        {bill.provider && `${bill.provider} • `}
                        {bill.recurrence_type}
                        {bill.recurrence_config?.exclude_week_numbers?.includes(1) && ' (skip 1st week)'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`text-xl font-bold ${bill.is_income ? 'text-green-400' : 'text-yellow-400'}`}>
                      {bill.is_income ? '+' : ''}${bill.amount.toFixed(2)}
                    </div>
                    <button
                      onClick={() => deleteBill(bill)}
                      className="px-3 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-sm transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
