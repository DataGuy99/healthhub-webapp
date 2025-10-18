// Custom hook for supplements data with React Query caching
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, Supplement, SupplementSection } from '../lib/supabase';
import { getCurrentUser } from '../lib/auth';

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
