// Custom hook for misc shop data using consolidated category_logs system
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface MiscShopPurchase {
  id: string;
  user_id: string;
  date: string;
  actual_amount: number;
  notes: string;
  item_name: string;  // Extracted from notes
  category: string;   // Extracted from notes or default 'misc'
  timestamp: string;
}

interface MiscShopBudget {
  id: string;
  user_id: string;
  category: string;
  month_year: string;
  target_amount: number;
  is_enabled: boolean;
}

export function useMiscShop(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['misc-shop', startDate, endDate],
    queryFn: async () => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      // Load purchases from category_logs (filter for misc purchases by checking notes)
      const { data: logsData, error: logsError } = await supabase
        .from('category_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('is_planned', false)  // Only actual purchases
        .order('date', { ascending: false });

      if (logsError) throw logsError;

      // Parse purchases - extract item name from notes
      const purchases: MiscShopPurchase[] = (logsData || [])
        .filter(log => !log.notes?.startsWith('Grocery:') && !log.notes?.startsWith('Supplement:'))
        .map(log => {
          // Extract item name from notes (format: "Item name. Additional notes")
          const notesMatch = log.notes?.match(/^([^.]+)/);
          const itemName = notesMatch ? notesMatch[1].trim() : 'Misc purchase';

          return {
            id: log.id,
            user_id: log.user_id,
            date: log.date,
            actual_amount: Number(log.actual_amount || 0),
            notes: log.notes || '',
            item_name: itemName,
            category: 'misc',
            timestamp: log.timestamp,
          };
        });

      // Load budget for current month
      const currentMonthYear = startDate.slice(0, 7); // "YYYY-MM"
      const { data: budgetData, error: budgetError } = await supabase
        .from('category_budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('category', 'misc')
        .eq('month_year', currentMonthYear)
        .single();

      if (budgetError && budgetError.code !== 'PGRST116') {
        console.log('Budget error:', budgetError);
      }

      return {
        purchases,
        budget: budgetData ? {
          id: budgetData.id,
          user_id: budgetData.user_id,
          category: budgetData.category,
          month_year: budgetData.month_year,
          target_amount: Number(budgetData.target_amount),
          is_enabled: budgetData.is_enabled,
        } : null,
      };
    },
    staleTime: 1000 * 60 * 2,  // Cache for 2 minutes
  });
}

export function useAddMiscPurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemName, amount, date, notes, category }: {
      itemName: string;
      amount: number;
      date: string;
      notes?: string;
      category?: string;
    }) => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      // Combine item name and notes
      const combinedNotes = notes ? `${itemName}. ${notes}` : itemName;

      const { data, error } = await supabase
        .from('category_logs')
        .insert({
          user_id: user.id,
          category_item_id: null,  // One-off purchase
          date,
          actual_amount: amount,
          notes: combinedNotes,
          is_planned: false,
          timestamp: new Date().toISOString(),
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['misc-shop'] });
      queryClient.invalidateQueries({ queryKey: ['overview-dashboard'] });
    },
  });
}

export function useUpdateMiscBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ monthYear, targetAmount }: {
      monthYear: string;
      targetAmount: number;
    }) => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      // Upsert budget for the month
      const { data, error } = await supabase
        .from('category_budgets')
        .upsert({
          user_id: user.id,
          category: 'misc',
          month_year: monthYear,
          target_amount: targetAmount,
          is_enabled: true,
        }, {
          onConflict: 'user_id,category,month_year'
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['misc-shop'] });
    },
  });
}

export function useDeleteMiscPurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('category_logs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    // Optimistic update
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['misc-shop'] });
      const previousData = queryClient.getQueryData(['misc-shop']);

      queryClient.setQueryData(['misc-shop'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          purchases: old.purchases.filter((p: any) => p.id !== id),
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['misc-shop'] });
      queryClient.invalidateQueries({ queryKey: ['overview-dashboard'] });
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['misc-shop'], context.previousData);
      }
    },
  });
}
