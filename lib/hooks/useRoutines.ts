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
import type { Routine, RoutineExercise, RoutineFolder } from '../types';

const ROUTINE_KEY = ['routines'];
const FOLDER_KEY = ['folders'];

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
    mutationFn: (data: { name: string; description?: string; categoryId?: number; folderId?: number }) =>
      createRoutine(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTINE_KEY });
      queryClient.invalidateQueries({ queryKey: FOLDER_KEY });
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
      data: { name?: string; description?: string; categoryId?: number; folderId?: number | null };
    }) => updateRoutine(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTINE_KEY });
      queryClient.invalidateQueries({ queryKey: FOLDER_KEY });
    },
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

export function useUpdateRoutineExerciseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, order }: { id: number; order: number }) =>
      updateRoutineExerciseOrder(id, order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ROUTINE_KEY });
    },
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
  });
}

// ─── Folder Hooks ──────────────────────────────────────

export function useFolders() {
  return useQuery<RoutineFolder[]>({
    queryKey: FOLDER_KEY,
    queryFn: getAllFolders,
  });
}

export function useFolder(id: number) {
  return useQuery<RoutineFolder[]>({
    queryKey: [...FOLDER_KEY, id],
    queryFn: () => getFolderById(id),
    enabled: !!id,
  });
}

export function useRoutinesByFolder(folderId: number) {
  return useQuery<Routine[]>({
    queryKey: [...FOLDER_KEY, folderId, 'routines'],
    queryFn: () => getRoutinesByFolder(folderId),
    enabled: !!folderId,
  });
}

export function useFolderRoutineCount(folderId: number) {
  return useQuery<number>({
    queryKey: [...FOLDER_KEY, folderId, 'count'],
    queryFn: () => getFolderRoutineCount(folderId),
    enabled: !!folderId,
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
  });
}
