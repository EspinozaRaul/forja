import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllSessions,
  getSessionById,
  createSession,
  completeSession,
  deleteSession,
  getSessionExercises,
  addExerciseToSession,
  updateSessionExerciseRestTime,
  updateSessionExerciseOrder,
  replaceSessionExercise,
  deleteSessionExercise,
  getLastSessionForRoutine,
  duplicateSessionData,
  createSuperSetPair,
  unlinkSuperSetPair,
} from '../db/queries';
import type { Session, SessionExercise } from '../types';

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

export function useSessionExercises(sessionId: number) {
  return useQuery<SessionExercise[]>({
    queryKey: [...SESSION_KEY, sessionId, 'exercises'],
    queryFn: () => getSessionExercises(sessionId),
    enabled: !!sessionId,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { routineId?: number }) => createSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    },
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
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    },
  });
}

export function useLastSessionForRoutine(routineId: number) {
  return useQuery({
    queryKey: ['sessions', 'lastForRoutine', routineId],
    queryFn: () => getLastSessionForRoutine(routineId),
    enabled: !!routineId,
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
    },
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
  });
}

export function useUpdateExerciseRestTime() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, restTime }: { id: number; restTime: number }) =>
      updateSessionExerciseRestTime(id, restTime),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    },
  });
}

export function useUpdateSessionExerciseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, order }: { id: number; order: number }) =>
      updateSessionExerciseOrder(id, order),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    },
  });
}

export function useReplaceSessionExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, exerciseId }: { id: number; exerciseId: number }) =>
      replaceSessionExercise(id, exerciseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    },
  });
}

export function useDeleteSessionExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteSessionExercise(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    },
  });
}

export function useCreateSuperSetPair() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ firstId, secondId }: { firstId: number; secondId: number }) =>
      createSuperSetPair(firstId, secondId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    },
  });
}

export function useUnlinkSuperSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pairId: number) => unlinkSuperSetPair(pairId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    },
  });
}
