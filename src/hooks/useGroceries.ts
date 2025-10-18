// Custom hook for grocery data using consolidated category_logs system
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface GroceryPurchase {
  id: string;
  user_id: string;
  date: string;
  actual_amount: number;
  notes: string;
  store: string;  // Extracted from notes
  protein_grams?: number;  // Extracted from notes
  timestamp: string;
}

interface GroceryBudget {
  id: string;
  user_id: string;
  category: string;
  month_year: string;
  target_amount: number;
  is_enabled: boolean;
}

export function useGroceries(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['groceries', startDate, endDate],
    queryFn: async () => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      // Load grocery purchases from category_logs
      const { data: logsData, error: logsError } = await supabase
        .from('category_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('is_planned', false)
        .order('date', { ascending: false });

      if (logsError) throw logsError;

      // Parse grocery purchases (notes start with "Grocery:")
      const purchases: GroceryPurchase[] = (logsData || [])
        .filter(log => log.notes?.startsWith('Grocery:'))
        .map(log => {
          // Extract store and protein from notes
          // Format: "Grocery: StoreName, XXg protein. Additional notes"
          const storeMatch = log.notes?.match(/Grocery:\s*([^,]+)/);
          const store = storeMatch ? storeMatch[1].trim() : 'Unknown';

          const proteinMatch = log.notes?.match(/(\d+\.?\d*)g protein/);
          const proteinGrams = proteinMatch ? parseFloat(proteinMatch[1]) : undefined;

          return {
            id: log.id,
            user_id: log.user_id,
            date: log.date,
            actual_amount: Number(log.actual_amount || 0),
            notes: log.notes || '',
            store,
            protein_grams: proteinGrams,
            timestamp: log.timestamp,
          };
        });

      // Load budget for current month
      const currentMonthYear = startDate.slice(0, 7);
      const { data: budgetData, error: budgetError } = await supabase
        .from('category_budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('category', 'groceries')
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
    staleTime: 1000 * 60 * 2,
  });
}

export function useAddGroceryPurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ store, amount, date, notes, proteinGrams }: {
      store: string;
      amount: number;
      date: string;
      notes?: string;
      proteinGrams?: number;
    }) => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      // Format notes: "Grocery: Store, XXg protein. Additional notes"
      let combinedNotes = `Grocery: ${store}`;
      if (proteinGrams) {
        combinedNotes += `, ${proteinGrams}g protein`;
      }
      if (notes) {
        combinedNotes += `. ${notes}`;
      }

      const { data, error } = await supabase
        .from('category_logs')
        .insert({
          user_id: user.id,
          category_item_id: null,
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
      queryClient.invalidateQueries({ queryKey: ['groceries'] });
      queryClient.invalidateQueries({ queryKey: ['overview-dashboard'] });
    },
  });
}

export function useUpdateGroceryBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ monthYear, targetAmount }: {
      monthYear: string;
      targetAmount: number;
    }) => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('category_budgets')
        .upsert({
          user_id: user.id,
          category: 'groceries',
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
      queryClient.invalidateQueries({ queryKey: ['groceries'] });
    },
  });
}

export function useDeleteGroceryPurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('category_logs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['groceries'] });
      const previousData = queryClient.getQueryData(['groceries']);

      queryClient.setQueryData(['groceries'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          purchases: old.purchases.filter((p: any) => p.id !== id),
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groceries'] });
      queryClient.invalidateQueries({ queryKey: ['overview-dashboard'] });
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['groceries'], context.previousData);
      }
    },
  });
}
