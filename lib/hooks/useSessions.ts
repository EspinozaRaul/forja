import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAllSessions,
  getSessionById,
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
  duplicateSessionData,
  createSuperSetPair,
  unlinkSuperSetPair,
} from '../db/queries';
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
    mutationFn: ({ id, restTime }: { id: number; restTime: number; sessionId: number }) =>
      updateSessionExerciseRestTime(id, restTime),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...SESSION_KEY, variables.sessionId, 'exercises'],
      });
    },
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
    },
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
  });
}

export function useUpdateSessionExerciseNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes, sessionId }: { id: number; notes: string | null; sessionId: number }) =>
      updateSessionExerciseNotes(id, notes),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...SESSION_KEY, variables.sessionId, 'exercises'],
      });
    },
  });
}
