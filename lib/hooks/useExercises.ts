import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllExercises,
  getExercisesByCategory,
  getExerciseById,
  createExercise,
  updateExercise,
  deleteExercise,
  getSetsByExerciseId,
} from '../db/queries';
import type { Exercise, Set } from '../types';

const EXERCISE_KEY = ['exercises'];

export function useExercises() {
  return useQuery<Exercise[]>({
    queryKey: EXERCISE_KEY,
    queryFn: getAllExercises,
  });
}

export function useExercisesByCategory(categoryId: number) {
  return useQuery<Exercise[]>({
    queryKey: [...EXERCISE_KEY, 'category', categoryId],
    queryFn: () => getExercisesByCategory(categoryId),
    enabled: !!categoryId,
  });
}

export function useExercise(id: number) {
  return useQuery<Exercise[]>({
    queryKey: [...EXERCISE_KEY, id],
    queryFn: () => getExerciseById(id),
    enabled: !!id,
  });
}

export function useCreateExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; categoryId: number; description?: string }) =>
      createExercise(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXERCISE_KEY });
    },
  });
}

export function useUpdateExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { name?: string; categoryId?: number; description?: string };
    }) => updateExercise(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXERCISE_KEY });
    },
  });
}

export function useDeleteExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteExercise(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXERCISE_KEY });
    },
  });
}

export function useExerciseHistory(exerciseId: number) {
  return useQuery<(Set & { sessionId: number })[]>({
    queryKey: [...EXERCISE_KEY, 'history', exerciseId],
    queryFn: () => getSetsByExerciseId(exerciseId),
    enabled: !!exerciseId,
  });
}
