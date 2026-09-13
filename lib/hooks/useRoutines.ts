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
  updateRoutineExerciseOrder,
  updateRoutineExerciseTargets,
  replaceRoutineExercise,
  getAllFolders,
  getFolderById,
  getRoutinesByFolder,
  getFolderRoutineCount,
  createFolder,
  updateFolder,
  deleteFolder,
} from '../db/queries';
import { mutationErrorHandler } from '../utils/mutation-error';
import { useCurrentUserId } from './useCurrentUser';
import type { Routine, RoutineExercise, RoutineFolder } from '../types';

const ROUTINE_KEY = ['routines'];
const FOLDER_KEY = ['folders'];

export function useRoutines() {
  const userId = useCurrentUserId();
  return useQuery<Routine[]>({
    queryKey: [...ROUTINE_KEY, userId],
    queryFn: getAllRoutines,
    enabled: !!userId,
  });
}

export function useRoutine(id: number) {
  const userId = useCurrentUserId();
  return useQuery<Routine[]>({
    queryKey: [...ROUTINE_KEY, id, userId],
    queryFn: () => getRoutineById(id),
    enabled: !!id && !!userId,
  });
}

export function useRoutineExercises(routineId: number) {
  const userId = useCurrentUserId();
  return useQuery<RoutineExercise[]>({
    queryKey: [...ROUTINE_KEY, routineId, 'exercises', userId],
    queryFn: () => getRoutineExercises(routineId),
    enabled: !!routineId && !!userId,
  });
}

export function useCreateRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; description?: string; categoryId?: number; folderId?: number }) =>
      createRoutine(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTINE_KEY });
      queryClient.invalidateQueries({ queryKey: FOLDER_KEY });
    },
    onError: mutationErrorHandler('Error al crear rutina'),
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
      data: { name?: string; description?: string; categoryId?: number; folderId?: number | null };
    }) => updateRoutine(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTINE_KEY });
      queryClient.invalidateQueries({ queryKey: FOLDER_KEY });
    },
    onError: mutationErrorHandler('Error al actualizar rutina'),
  });
}

export function useDeleteRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteRoutine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTINE_KEY });
      queryClient.invalidateQueries({ queryKey: FOLDER_KEY });
    },
    onError: mutationErrorHandler('Error al eliminar rutina'),
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
    onError: mutationErrorHandler('Error al agregar ejercicio'),
  });
}

export function useRemoveExerciseFromRoutine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => removeExerciseFromRoutine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTINE_KEY });
    },
    onError: mutationErrorHandler('Error al eliminar ejercicio'),
  });
}

export function useUpdateRoutineExerciseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, order }: { id: number; order: number }) =>
      updateRoutineExerciseOrder(id, order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTINE_KEY });
    },
    onError: mutationErrorHandler('Error al reordenar ejercicios'),
  });
}

export function useUpdateRoutineExerciseTargets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { targetSets?: number; targetReps?: number };
    }) => updateRoutineExerciseTargets(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTINE_KEY });
    },
    onError: mutationErrorHandler('Error al actualizar objetivos'),
  });
}

export function useReplaceRoutineExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, exerciseId }: { id: number; exerciseId: number }) =>
      replaceRoutineExercise(id, exerciseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTINE_KEY });
    },
    onError: mutationErrorHandler('Error al reemplazar ejercicio'),
  });
}

// ─── Folder Hooks ──────────────────────────────────────

export function useFolders() {
  const userId = useCurrentUserId();
  return useQuery<RoutineFolder[]>({
    queryKey: [...FOLDER_KEY, userId],
    queryFn: getAllFolders,
    enabled: !!userId,
  });
}

export function useFolder(id: number) {
  const userId = useCurrentUserId();
  return useQuery<RoutineFolder[]>({
    queryKey: [...FOLDER_KEY, id, userId],
    queryFn: () => getFolderById(id),
    enabled: !!id && !!userId,
  });
}

export function useRoutinesByFolder(folderId: number) {
  const userId = useCurrentUserId();
  return useQuery<Routine[]>({
    queryKey: [...FOLDER_KEY, folderId, 'routines', userId],
    queryFn: () => getRoutinesByFolder(folderId),
    enabled: !!folderId && !!userId,
  });
}

export function useFolderRoutineCount(folderId: number) {
  const userId = useCurrentUserId();
  return useQuery<number>({
    queryKey: [...FOLDER_KEY, folderId, 'count', userId],
    queryFn: () => getFolderRoutineCount(folderId),
    enabled: !!folderId && !!userId,
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; description?: string; color?: string; icon?: string }) =>
      createFolder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FOLDER_KEY });
    },
    onError: mutationErrorHandler('Error al crear carpeta'),
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { name?: string; description?: string; color?: string; icon?: string };
    }) => updateFolder(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FOLDER_KEY });
    },
    onError: mutationErrorHandler('Error al actualizar carpeta'),
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FOLDER_KEY });
      queryClient.invalidateQueries({ queryKey: ROUTINE_KEY });
    },
    onError: mutationErrorHandler('Error al eliminar carpeta'),
  });
}
