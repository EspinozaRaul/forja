import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllExercises,
  getExercisesByCategory,
  getExerciseById,
  createExercise,
  updateExercise,
  deleteExercise,
  getSetsByExerciseId,
  getExerciseStats,
  getExerciseSessions,
  getExercisePRs,
  getLastWeightByExerciseIds,
  getMaxWeightByExerciseIds,
  getLastRepsByExerciseIds,
  getLastWorkoutPerExercise,
  getLastRirByRoutineExerciseIds,
} from '../db/queries';
import { mutationErrorHandler } from '../utils/mutation-error';
import { useCurrentUserId } from './useCurrentUser';
import type { Exercise, Set } from '../types';
import type { ExerciseStats, ExerciseSessionEntry, ExercisePRs, LastWorkoutPerExercise } from '../db/queries';

const EXERCISE_KEY = ['exercises'];

export function useExercises() {
  const userId = useCurrentUserId();
  return useQuery<Exercise[]>({
    queryKey: [...EXERCISE_KEY, userId],
    queryFn: getAllExercises,
    enabled: !!userId,
  });
}

export function useExercisesByCategory(categoryId: number) {
  const userId = useCurrentUserId();
  return useQuery<Exercise[]>({
    queryKey: [...EXERCISE_KEY, 'category', categoryId, userId],
    queryFn: () => getExercisesByCategory(categoryId),
    enabled: !!categoryId && !!userId,
  });
}

export function useExercise(id: number) {
  const userId = useCurrentUserId();
  return useQuery<Exercise[]>({
    queryKey: [...EXERCISE_KEY, id, userId],
    queryFn: () => getExerciseById(id),
    enabled: !!id && !!userId,
  });
}

export function useCreateExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; categoryId: number; description?: string; unit?: string }) =>
      createExercise(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXERCISE_KEY });
    },
    onError: mutationErrorHandler('Error al crear ejercicio'),
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
      data: { name?: string; categoryId?: number; description?: string; unit?: string };
    }) => updateExercise(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXERCISE_KEY });
    },
    onError: mutationErrorHandler('Error al actualizar ejercicio'),
  });
}

export function useDeleteExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteExercise(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXERCISE_KEY });
    },
    onError: mutationErrorHandler('Error al eliminar ejercicio'),
  });
}

export function useLastWeightByExerciseIds(exerciseIds: number[]) {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: [EXERCISE_KEY, 'lastWeight', [...exerciseIds].sort(), userId],
    queryFn: () => getLastWeightByExerciseIds(exerciseIds),
    enabled: exerciseIds.length > 0 && !!userId,
  });
}

export function useMaxWeightByExerciseIds(exerciseIds: number[]) {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: [EXERCISE_KEY, 'maxWeight', [...exerciseIds].sort(), userId],
    queryFn: () => getMaxWeightByExerciseIds(exerciseIds),
    enabled: exerciseIds.length > 0 && !!userId,
  });
}

export function useLastRepsByExerciseIds(exerciseIds: number[]) {
  const userId = useCurrentUserId();
  return useQuery({
    queryKey: [EXERCISE_KEY, 'lastReps', [...exerciseIds].sort(), userId],
    queryFn: () => getLastRepsByExerciseIds(exerciseIds),
    enabled: exerciseIds.length > 0 && !!userId,
  });
}

export function useLastWorkoutPerExercise(exerciseIds: number[]) {
  const userId = useCurrentUserId();
  return useQuery<Record<number, LastWorkoutPerExercise | null>>({
    queryKey: [EXERCISE_KEY, 'lastWorkout', [...exerciseIds].sort(), userId],
    queryFn: () => getLastWorkoutPerExercise(exerciseIds),
    enabled: exerciseIds.length > 0 && !!userId,
  });
}

export function useExerciseHistory(exerciseId: number) {
  const userId = useCurrentUserId();
  return useQuery<(Set & { sessionId: number })[]>({
    queryKey: [...EXERCISE_KEY, 'history', exerciseId, userId],
    queryFn: () => getSetsByExerciseId(exerciseId),
    enabled: !!exerciseId && !!userId,
  });
}

export function useExerciseStats(exerciseId: number) {
  const userId = useCurrentUserId();
  return useQuery<ExerciseStats>({
    queryKey: [...EXERCISE_KEY, 'stats', exerciseId, userId],
    queryFn: () => getExerciseStats(exerciseId),
    enabled: !!exerciseId && !!userId,
  });
}

export function useExerciseSessions(exerciseId: number) {
  const userId = useCurrentUserId();
  return useQuery<ExerciseSessionEntry[]>({
    queryKey: [...EXERCISE_KEY, 'sessions', exerciseId, userId],
    queryFn: () => getExerciseSessions(exerciseId),
    enabled: !!exerciseId && !!userId,
  });
}

export function useExercisePRs(exerciseId: number) {
  const userId = useCurrentUserId();
  return useQuery<ExercisePRs>({
    queryKey: [...EXERCISE_KEY, 'prs', exerciseId, userId],
    queryFn: () => getExercisePRs(exerciseId),
    enabled: !!exerciseId && !!userId,
  });
}

export function useLastRirByRoutineExerciseIds(routineId: number, exerciseIds: number[]) {
  const userId = useCurrentUserId();
  return useQuery<Record<number, Record<number, number | null>>>({
    queryKey: [...EXERCISE_KEY, 'lastRir', routineId, [...exerciseIds].sort(), userId],
    queryFn: () => getLastRirByRoutineExerciseIds(routineId, exerciseIds),
    enabled: !!routineId && exerciseIds.length > 0 && !!userId,
  });
}
