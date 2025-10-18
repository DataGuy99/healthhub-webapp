// Custom hook for Overview dashboard data with React Query caching
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface CategorySpending {
  name: string;
  value: number;
  color: string;
  icon: string;
}

interface TrendDataPoint {
  date: string;
  spending: number;
  health: number;
  supplements: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  grocery: '#10b981',
  supplements: '#a855f7',
  auto: '#ef4444',
  bills: '#f59e0b',
  'misc-shop': '#ec4899',
  'misc-health': '#14b8a6',
  rent: '#3b82f6',
};

const CATEGORY_ICONS: Record<string, string> = {
  grocery: '🛒',
  supplements: '💊',
  auto: '🚗',
  bills: '💡',
  'misc-shop': '🛍️',
  'misc-health': '🏥',
  rent: '🏠',
};

export function useOverviewData() {
  return useQuery({
    queryKey: ['overview-dashboard'],
    queryFn: async () => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const currentMonth = new Date().toISOString().slice(0, 7);
      const startDate = `${currentMonth}-01`;
      const endDate = `${currentMonth}-31`;

      // Fetch ALL category spending (including one-off purchases)
      const { data: logsData } = await supabase
        .from('category_logs')
        .select('*, category_items(category)')  // LEFT JOIN, not INNER
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      const spendingMap = new Map<string, number>();
      logsData?.forEach((log: any) => {
        let category: string | null = null;

        // First try to get category from category_items
        if (log.category_items?.category) {
          category = log.category_items.category;
        }
        // Otherwise, infer category from notes for one-off purchases
        else if (log.notes) {
          if (log.notes.startsWith('Grocery:')) {
            category = 'groceries';
          } else if (log.notes.startsWith('Supplement:')) {
            category = 'supplements';
          } else {
            category = 'misc';  // Default for misc shop purchases
          }
        }

        if (category) {
          const current = spendingMap.get(category) || 0;
          spendingMap.set(category, current + Number(log.actual_amount || 0));
        }
      });

      // Load gas fillup costs for current month
      const { data: gasFillupsData } = await supabase
        .from('gas_fillups')
        .select('cost')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      const gasFillupTotal = gasFillupsData?.reduce((sum, fillup) => sum + (fillup.cost || 0), 0) || 0;

      // Add gas fillups to 'auto' category spending
      const currentAutoSpending = spendingMap.get('auto') || 0;
      spendingMap.set('auto', currentAutoSpending + gasFillupTotal);

      const spending: CategorySpending[] = Array.from(spendingMap.entries()).map(([name, value]) => ({
        name,
        value,
        color: CATEGORY_COLORS[name] || '#6b7280',
        icon: CATEGORY_ICONS[name] || '📁',
      }));

      // Load budgets
      const { data: budgetsData } = await supabase
        .from('category_budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', currentMonth);

      const totalBudget = budgetsData?.reduce((sum, b) => sum + b.target_amount, 0) || 0;
      const totalSpent = spending.reduce((sum, cat) => sum + cat.value, 0);

      // Load trend data (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().slice(0, 10);
      });

      const trendData: TrendDataPoint[] = await Promise.all(
        last7Days.map(async (date) => {
          const { data } = await supabase
            .from('category_logs')
            .select('actual_amount')
            .eq('user_id', user.id)
            .eq('date', date);

          const daySpending = data?.reduce((sum, log) => sum + (log.actual_amount || 0), 0) || 0;

          return {
            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            spending: daySpending,
            health: 0,
            supplements: 0,
          };
        })
      );

      // Load supplement count
      const { data: supps } = await supabase
        .from('supplements')
        .select('id')
        .eq('user_id', user.id);

      const supplementCount = supps?.length || 0;

      // Load MPG data
      const { data: fillups } = await supabase
        .from('gas_fillups')
        .select('mileage, mpg')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .order('mileage', { ascending: false })
        .limit(10);

      let currentMileage = 0;
      let avgMPG = 0;

      if (fillups && fillups.length > 0) {
        currentMileage = Number(fillups[0].mileage) || 0;
        const mpgValues = fillups.filter(f => f.mpg !== null).map(f => Number(f.mpg));
        if (mpgValues.length > 0) {
          avgMPG = mpgValues.reduce((sum, mpg) => sum + mpg, 0) / mpgValues.length;
        }
      }

      // Load today's supplement progress
      const today = new Date().toISOString().split('T')[0];
      const { data: todayLogs } = await supabase
        .from('supplement_logs')
        .select('is_taken')
        .eq('user_id', user.id)
        .eq('date', today);

      const supplementsTakenToday = todayLogs?.filter(log => log.is_taken).length || 0;
      const supplementsTotalToday = todayLogs?.length || 0;

      return {
        categorySpending: spending,
        trendData,
        totalSpent,
        totalBudget,
        supplementCount,
        avgMPG,
        currentMileage,
        supplementsTakenToday,
        supplementsTotalToday,
      };
    },
    // Refetch every 30 seconds when window is focused for fresh data
    refetchInterval: 30000,
  });
}
