// Custom hook for supplements data with React Query caching
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Supplement, SupplementSection } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface SupplementPurchase {
  id: string;
  user_id: string;
  date: string;
  actual_amount: number;
  notes: string;
  supplement_name: string;  // Extracted from notes
  quantity: number;  // Extracted from notes
  timestamp: string;
}

export function useSupplements() {
  return useQuery({
    queryKey: ['supplements'],
    queryFn: async () => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const { data: supplementsData, error: supplementsError } = await supabase
        .from('supplements')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (supplementsError) throw supplementsError;

      let { data: sectionsData, error: sectionsError } = await supabase
        .from('supplement_sections')
        .select('*')
        .eq('user_id', user.id)
        .order('order', { ascending: true });

      if (sectionsError) throw sectionsError;

      // Auto-create default sections if none exist
      if (!sectionsData || sectionsData.length === 0) {
        const defaultSections = [
          { user_id: user.id, name: 'Morning', order: 1 },
          { user_id: user.id, name: 'Afternoon', order: 2 },
          { user_id: user.id, name: 'Evening', order: 3 },
          { user_id: user.id, name: 'Before Bed', order: 4 },
        ];

        const { data: createdSections, error: createError } = await supabase
          .from('supplement_sections')
          .insert(defaultSections)
          .select();

        if (!createError) {
          sectionsData = createdSections;
        }
      }

      return {
        supplements: supplementsData || [],
        sections: sectionsData || [],
      };
    },
  });
}

export function useAddSupplement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (supplement: Omit<Supplement, 'id' | 'user_id' | 'created_at'>) => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('supplements')
        .insert([{ user_id: user.id, ...supplement }])
        .select();

      if (error) throw error;
      return data;
    },
    // Optimistic update: immediately show the new supplement before server responds
    onMutate: async (newSupplement) => {
      await queryClient.cancelQueries({ queryKey: ['supplements'] });
      const previousData = queryClient.getQueryData(['supplements']);

      queryClient.setQueryData(['supplements'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          supplements: [{
            ...newSupplement,
            id: 'temp-' + Date.now(),
            created_at: new Date().toISOString(),
          }, ...old.supplements],
        };
      });

      return { previousData };
    },
    // On success, refetch to get the real data from server
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplements'] });
    },
    // On error, rollback to previous data
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['supplements'], context.previousData);
      }
    },
  });
}

export function useUpdateSupplement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Supplement> & { id: string }) => {
      const { error } = await supabase
        .from('supplements')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplements'] });
    },
  });
}

export function useDeleteSupplement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('supplements')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplements'] });
    },
  });
}

// Supplement purchases (using category_logs)
export function useSupplementPurchases(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['supplement-purchases', startDate, endDate],
    queryFn: async () => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      // Load supplement purchases from category_logs
      const { data: logsData, error: logsError } = await supabase
        .from('category_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('is_planned', false)
        .order('date', { ascending: false });

      if (logsError) throw logsError;

      // Parse supplement purchases (notes start with "Supplement:")
      const purchases: SupplementPurchase[] = (logsData || [])
        .filter(log => log.notes?.startsWith('Supplement:'))
        .map(log => {
          // Extract supplement name and quantity from notes
          // Format: "Supplement: Name (qty: X). Additional notes"
          const nameMatch = log.notes?.match(/Supplement:\s*([^(]+)/);
          const supplementName = nameMatch ? nameMatch[1].trim() : 'Unknown';

          const quantityMatch = log.notes?.match(/qty:\s*(\d+)/);
          const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;

          return {
            id: log.id,
            user_id: log.user_id,
            date: log.date,
            actual_amount: Number(log.actual_amount || 0),
            notes: log.notes || '',
            supplement_name: supplementName,
            quantity,
            timestamp: log.timestamp,
          };
        });

      // Load budget for current month
      const currentMonthYear = startDate.slice(0, 7);
      const { data: budgetData, error: budgetError } = await supabase
        .from('category_budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('category', 'supplements')
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

export function useAddSupplementPurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ supplementName, cost, date, quantity, notes }: {
      supplementName: string;
      cost: number;
      date: string;
      quantity?: number;
      notes?: string;
    }) => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      // Format notes: "Supplement: Name (qty: X). Additional notes"
      let combinedNotes = `Supplement: ${supplementName}`;
      if (quantity && quantity > 1) {
        combinedNotes += ` (qty: ${quantity})`;
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
          actual_amount: cost,
          notes: combinedNotes,
          is_planned: false,
          timestamp: new Date().toISOString(),
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplement-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['overview-dashboard'] });
    },
  });
}

export function useUpdateSupplementBudget() {
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
          category: 'supplements',
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
      queryClient.invalidateQueries({ queryKey: ['supplement-purchases'] });
    },
  });
}

export function useDeleteSupplementPurchase() {
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
      await queryClient.cancelQueries({ queryKey: ['supplement-purchases'] });
      const previousData = queryClient.getQueryData(['supplement-purchases']);

      queryClient.setQueryData(['supplement-purchases'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          purchases: old.purchases.filter((p: any) => p.id !== id),
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplement-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['overview-dashboard'] });
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['supplement-purchases'], context.previousData);
      }
    },
  });
}
