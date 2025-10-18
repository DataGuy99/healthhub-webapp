// Custom hook for bills data with React Query caching
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface RecurringBill {
  id?: string;
  user_id?: string;
  name: string;
  amount: number;
  recurrence_type: 'monthly' | 'weekly' | 'biweekly' | 'custom';
  recurrence_config?: any;
  provider?: string;
  is_income: boolean;
  is_active: boolean;
  frequency?: string;
  day_of_week?: number | null;
  day_of_month?: number | null;
  skip_first_week?: boolean;
  color?: string;
  icon?: string;
  created_at?: string;
}

interface BillPayment {
  id?: string;
  user_id?: string;
  recurring_bill_id: string;
  bill_id?: string;
  date: string;
  amount: number;
  paid?: boolean;
  notes?: string;
  paid_at?: string;
}

export function useBills(currentMonth: Date) {
  const monthYear = currentMonth.toISOString().slice(0, 7);

  return useQuery({
    queryKey: ['bills', monthYear],
    queryFn: async () => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const { data: bills, error: billsError } = await supabase
        .from('recurring_bills')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (billsError) throw billsError;

      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const { data: payments, error: paymentsError } = await supabase
        .from('bill_payments')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      if (paymentsError) throw paymentsError;

      return {
        bills: bills || [],
        payments: payments || [],
      };
    },
    // Cache for 2 minutes since bills don't change frequently
    staleTime: 1000 * 60 * 2,
  });
}

export function useAddBill() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bill: RecurringBill) => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('recurring_bills')
        .insert({ ...bill, user_id: user.id })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate all bill queries to refetch
      queryClient.invalidateQueries({ queryKey: ['bills'] });
    },
  });
}

export function useTogglePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ billId, date, amount, existingPaymentId }: {
      billId: string;
      date: string;
      amount: number;
      existingPaymentId?: string;
    }) => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      if (existingPaymentId) {
        // Delete existing payment
        const { error } = await supabase
          .from('bill_payments')
          .delete()
          .eq('id', existingPaymentId);

        if (error) throw error;
      } else {
        // Create new payment
        const { error } = await supabase
          .from('bill_payments')
          .insert({
            user_id: user.id,
            recurring_bill_id: billId,
            bill_id: billId,
            date,
            amount,
            paid: true,
            paid_at: new Date().toISOString(),
          });

        if (error) throw error;
      }
    },
    // Optimistic update for instant feedback
    onMutate: async ({ date }) => {
      const monthYear = date.slice(0, 7);
      await queryClient.cancelQueries({ queryKey: ['bills', monthYear] });
      // Return context for rollback if needed
      return { monthYear };
    },
    onSuccess: (_, variables, context) => {
      if (context) {
        queryClient.invalidateQueries({ queryKey: ['bills', context.monthYear] });
      }
    },
  });
}
