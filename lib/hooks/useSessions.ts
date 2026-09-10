import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllSessions,
  getSessionById,
  getActiveSession,
  createSession,
  completeSession,
  deleteSession,
  getSessionExercises,
  getSessionExercisesWithSets,
  addExerciseToSession,
  updateSessionExerciseRestTime,
  updateSessionExerciseOrder,
  replaceSessionExercise,
  deleteSessionExercise,
  updateSessionExerciseNotes,
  getLastSessionForRoutine,
  getLastSetsForExercise,
  getLastSetsPerExercise,
  getLastNotesByExerciseIds,
  duplicateSessionData,
  createSuperSetPair,
  unlinkSuperSetPair,
} from '../db/queries';
import { mutationErrorHandler } from '../utils/mutation-error';
import type { Session, SessionExercise } from '../types';
import type { SessionExerciseWithSets } from '../db/queries';

const SESSION_KEY = ['sessions'];

export function useSessions() {
  return useQuery<Session[]>({
    queryKey: SESSION_KEY,
    queryFn: getAllSessions,
  });
}

export function useSession(id: number) {
  return useQuery<Session[]>({
    queryKey: [...SESSION_KEY, id],
    queryFn: () => getSessionById(id),
    enabled: !!id,
  });
}

export function useActiveSession() {
  return useQuery({
    queryKey: ['activeSession'],
    queryFn: getActiveSession,
    refetchInterval: 60000,
  });
}

export function useSessionExercises(sessionId: number) {
  return useQuery<SessionExercise[]>({
    queryKey: [...SESSION_KEY, sessionId, 'exercises'],
    queryFn: () => getSessionExercises(sessionId),
    enabled: !!sessionId,
  });
}

export function useSessionExercisesWithSets(sessionId: number) {
  return useQuery<SessionExerciseWithSets[]>({
    queryKey: [...SESSION_KEY, sessionId, 'exercises', 'withSets'],
    queryFn: () => getSessionExercisesWithSets(sessionId),
    enabled: !!sessionId,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { routineId?: number }) => createSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      queryClient.invalidateQueries({ queryKey: ['activeSession'] });
    },
    onError: mutationErrorHandler('Error al crear sesión'),
  });
}

export function useCompleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { completedAt?: Date; duration?: number; notes?: string };
    }) => completeSession(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      queryClient.invalidateQueries({ queryKey: ['activeSession'] });
      queryClient.invalidateQueries({ queryKey: ['globalStats'] });
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
    onError: mutationErrorHandler('Error al finalizar sesión'),
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      queryClient.invalidateQueries({ queryKey: ['activeSession'] });
      queryClient.invalidateQueries({ queryKey: ['globalStats'] });
      queryClient.invalidateQueries({ queryKey: ['exercises'] });
    },
    onError: mutationErrorHandler('Error al eliminar sesión'),
  });
}

export function useLastSessionForRoutine(routineId: number) {
  return useQuery({
    queryKey: ['sessions', 'lastForRoutine', routineId],
    queryFn: () => getLastSessionForRoutine(routineId),
    enabled: !!routineId,
  });
}

export function useLastSetsForExercise(exerciseId: number) {
  return useQuery({
    queryKey: ['sessions', 'lastSetsForExercise', exerciseId],
    queryFn: () => getLastSetsForExercise(exerciseId),
    enabled: !!exerciseId,
  });
}

export function useLastSetsPerExercise(exerciseIds: number[]) {
  return useQuery({
    queryKey: ['sessions', 'lastSetsPerExercise', [...exerciseIds].sort()],
    queryFn: () => getLastSetsPerExercise(exerciseIds),
    enabled: exerciseIds.length > 0,
  });
}

export function useLastNotesByExerciseIds(exerciseIds: number[]) {
  return useQuery({
    queryKey: ['sessions', 'lastNotes', [...exerciseIds].sort()],
    queryFn: () => getLastNotesByExerciseIds(exerciseIds),
    enabled: exerciseIds.length > 0,
  });
}

export function useDuplicateSessionData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sourceSessionId,
      targetSessionId,
    }: {
      sourceSessionId: number;
      targetSessionId: number;
    }) => duplicateSessionData(sourceSessionId, targetSessionId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...SESSION_KEY, variables.targetSessionId, 'exercises'],
      });
      queryClient.invalidateQueries({
        queryKey: [...SESSION_KEY, variables.targetSessionId, 'exercises', 'withSets'],
      });
    },
    onError: mutationErrorHandler('Error al duplicar sesión'),
  });
}

export function useAddExerciseToSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      sessionId: number;
      exerciseId: number;
      order: number;
      notes?: string;
    }) => addExerciseToSession(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...SESSION_KEY, variables.sessionId, 'exercises'],
      });
    },
    onError: mutationErrorHandler('Error al agregar ejercicio'),
  });
}

export function useUpdateExerciseRestTime() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, restTime }: { id: number; restTime: number; sessionId: number }) =>
      updateSessionExerciseRestTime(id, restTime),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...SESSION_KEY, variables.sessionId, 'exercises'],
      });
    },
    onError: mutationErrorHandler('Error al actualizar descanso'),
  });
}

export function useUpdateSessionExerciseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, order }: { id: number; order: number; sessionId: number }) =>
      updateSessionExerciseOrder(id, order),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...SESSION_KEY, variables.sessionId, 'exercises'],
      });
    },
    onError: mutationErrorHandler('Error al reordenar ejercicios'),
  });
}

export function useReplaceSessionExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, exerciseId }: { id: number; exerciseId: number; sessionId: number }) =>
      replaceSessionExercise(id, exerciseId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...SESSION_KEY, variables.sessionId, 'exercises'],
      });
    },
    onError: mutationErrorHandler('Error al reemplazar ejercicio'),
  });
}

export function useDeleteSessionExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, sessionId }: { id: number; sessionId: number }) => deleteSessionExercise(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...SESSION_KEY, variables.sessionId, 'exercises'],
      });
      queryClient.invalidateQueries({
        queryKey: [...SESSION_KEY, variables.sessionId, 'exercises', 'withSets'],
      });
    },
    onError: mutationErrorHandler('Error al eliminar ejercicio'),
  });
}

export function useCreateSuperSetPair() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ firstId, secondId, sessionId }: { firstId: number; secondId: number; sessionId: number }) =>
      createSuperSetPair(firstId, secondId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...SESSION_KEY, variables.sessionId, 'exercises'],
      });
    },
    onError: mutationErrorHandler('Error al crear super set'),
  });
}

export function useUnlinkSuperSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pairId, sessionId }: { pairId: number; sessionId: number }) => unlinkSuperSetPair(pairId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...SESSION_KEY, variables.sessionId, 'exercises'],
      });
    },
    onError: mutationErrorHandler('Error al desvincular super set'),
  });
}

export function useUpdateSessionExerciseNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes, noteType, sessionId }: { id: number; notes: string | null; noteType?: string | null; sessionId: number }) =>
      updateSessionExerciseNotes(id, notes, noteType),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...SESSION_KEY, variables.sessionId, 'exercises'],
      });
    },
    onError: mutationErrorHandler('Error al guardar notas'),
  });
}
