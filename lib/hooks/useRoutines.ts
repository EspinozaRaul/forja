import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllRoutines,
  getRoutineById,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  getRoutineExercises,
  addExerciseToRoutine,
  removeExerciseFromRoutine,
} from '../db/queries';
import type { Routine, RoutineExercise } from '../types';

const ROUTINE_KEY = ['routines'];

export function useRoutines() {
  return useQuery<Routine[]>({
    queryKey: ROUTINE_KEY,
    queryFn: getAllRoutines,
  });
}

export function useRoutine(id: number) {
  return useQuery<Routine[]>({
    queryKey: [...ROUTINE_KEY, id],
    queryFn: () => getRoutineById(id),
    enabled: !!id,
  });
}

export function useRoutineExercises(routineId: number) {
  return useQuery<RoutineExercise[]>({
    queryKey: [...ROUTINE_KEY, routineId, 'exercises'],
    queryFn: () => getRoutineExercises(routineId),
    enabled: !!routineId,
  });
}

export function useCreateRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; description?: string; categoryId?: number }) =>
      createRoutine(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTINE_KEY });
    },
  });
}

export function useUpdateRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { name?: string; description?: string; categoryId?: number };
    }) => updateRoutine(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTINE_KEY });
    },
  });
}

export function useDeleteRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteRoutine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTINE_KEY });
    },
  });
}

export function useAddExerciseToRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      routineId: number;
      exerciseId: number;
      order: number;
      targetSets?: number;
      targetReps?: number;
    }) => addExerciseToRoutine(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...ROUTINE_KEY, variables.routineId, 'exercises'],
      });
    },
  });
}

export function useRemoveExerciseFromRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => removeExerciseFromRoutine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTINE_KEY });
    },
  });
}
