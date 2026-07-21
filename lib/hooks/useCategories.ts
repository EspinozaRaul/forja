import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllCategories, getCategoryById, createCategory } from '../db/queries';
import type { Category } from '../types';

const CATEGORY_KEY = ['categories'];

export function useCategories() {
  return useQuery<Category[]>({
    queryKey: CATEGORY_KEY,
    queryFn: getAllCategories,
  });
}

export function useCategory(id: number) {
  return useQuery<Category[]>({
    queryKey: [...CATEGORY_KEY, id],
    queryFn: () => getCategoryById(id),
    enabled: !!id,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; color: string; icon: string }) =>
      createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORY_KEY });
    },
  });
}
