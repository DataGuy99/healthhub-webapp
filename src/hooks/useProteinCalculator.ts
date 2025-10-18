// Custom hook for protein calculator data with React Query caching
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

interface ProteinCalculation {
  id?: string;
  user_id?: string;
  food_name: string;
  serving_size: number;
  serving_unit: string;
  protein_grams: number;
  price: number;
  cost_per_gram: number;
  notes?: string;
  created_at?: string;
}

export function useProteinCalculator() {
  return useQuery({
    queryKey: ['protein-calculator'],
    queryFn: async () => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      // Load favorite foods
      const { data: favoritesData, error: favoritesError } = await supabase
        .from('favorite_foods')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (favoritesError) throw favoritesError;

      return {
        favorites: favoritesData || [],
      };
    },
    // Cache favorite foods for 3 minutes
    staleTime: 1000 * 60 * 3,
  });
}

export function useAddFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (food: Omit<ProteinCalculation, 'id' | 'user_id' | 'created_at'>) => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('favorite_foods')
        .insert({
          user_id: user.id,
          ...food,
          created_at: new Date().toISOString(),
        })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['protein-calculator'] });
    },
  });
}

export function useMarkAsBought() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ foodName, totalCost, quantity }: {
      foodName: string;
      totalCost: number;
      quantity: number;
    }) => {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('category_logs')
        .insert({
          user_id: user.id,
          category_item_id: null,
          date: new Date().toISOString().split('T')[0],
          actual_amount: totalCost,
          notes: `Bought ${quantity}x ${foodName}`,
          timestamp: new Date().toISOString(),
        });

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate overview data to update spending
      queryClient.invalidateQueries({ queryKey: ['overview-dashboard'] });
    },
  });
}

export function useRemoveFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('favorite_foods')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    // Optimistic update: remove immediately
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['protein-calculator'] });
      const previousData = queryClient.getQueryData(['protein-calculator']);

      queryClient.setQueryData(['protein-calculator'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          favorites: old.favorites.filter((f: any) => f.id !== id),
        };
      });

      return { previousData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['protein-calculator'] });
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['protein-calculator'], context.previousData);
      }
    },
  });
}
