import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSetsForSessionExercise,
  createSet,
  updateSet,
  deleteSet,
} from '../db/queries';
import type { Set } from '../types';

const SET_KEY = ['sets'];

export function useSets(sessionExerciseId: number) {
  return useQuery<Set[]>({
    queryKey: [...SET_KEY, sessionExerciseId],
    queryFn: () => getSetsForSessionExercise(sessionExerciseId),
    enabled: !!sessionExerciseId,
  });
}

export function useCreateSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      sessionExerciseId: number;
      setNumber: number;
      reps?: number;
      weight?: number;
    }) => createSet(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...SET_KEY, variables.sessionExerciseId],
      });
    },
  });
}

export function useUpdateSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { reps?: number; weight?: number; completed?: boolean };
    }) => updateSet(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SET_KEY });
    },
  });
}

export function useDeleteSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteSet(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SET_KEY });
    },
  });
}
