import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSetsForSessionExercise,
  createSet,
  createDropSets,
  updateSet,
  deleteSet,
  deleteDropSetGroup,
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
      method?: string;
      dropOrder?: number;
      isDropGroup?: boolean;
      rir?: number;
    }) => createSet(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...SET_KEY, variables.sessionExerciseId],
      });
      queryClient.invalidateQueries({ queryKey: ['exercises', 'maxWeight'] });
    },
  });
}

export function useCreateDropSets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      sessionExerciseId: number;
      setNumber: number;
      method?: string;
      drops: Array<{ reps?: number; weight?: number; rir?: number }>;
    }) => createDropSets(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...SET_KEY, variables.sessionExerciseId],
      });
      queryClient.invalidateQueries({ queryKey: ['exercises', 'maxWeight'] });
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
      data: { reps?: number; weight?: number; completed?: boolean; rir?: number | null; method?: string; isDropGroup?: boolean };
      sessionExerciseId: number;
    }) => updateSet(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...SET_KEY, variables.sessionExerciseId],
      });
      queryClient.invalidateQueries({ queryKey: ['exercises', 'maxWeight'] });
    },
  });
}

export function useDeleteSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      sessionExerciseId,
    }: {
      id: number;
      sessionExerciseId: number;
    }) => deleteSet(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...SET_KEY, variables.sessionExerciseId],
      });
      queryClient.invalidateQueries({ queryKey: ['exercises', 'maxWeight'] });
    },
  });
}

export function useDeleteDropSetGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionExerciseId,
      setNumber,
    }: {
      sessionExerciseId: number;
      setNumber: number;
    }) => deleteDropSetGroup(sessionExerciseId, setNumber),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...SET_KEY, variables.sessionExerciseId],
      });
      queryClient.invalidateQueries({ queryKey: ['exercises', 'maxWeight'] });
    },
  });
}
