import { useQuery } from '@tanstack/react-query';
import { db } from '../db';
import { sets, sessionExercises, sessions } from '../db/schema';
import { eq, sql, and, gte, lte, isNotNull } from 'drizzle-orm';
import { getWeeklySessions } from '../db/queries';
import { ownedByCurrentUser } from '../db/user-scope';
import { useCurrentUserId } from './useCurrentUser';
import { getSessionsByMonth, getSessionMonthIndex, getSessionWithSets, getSessionCompare, getMostUsedExercises, getRoutineSessionsByPeriods, buildRoutineComparison } from '../progress';
import type { SessionByMonth, SessionMonthIndexEntry, SessionDetail, SessionCompareResult, MostUsedExercise, RoutineComparisonData } from '../progress';
import type { ProgressDataPoint, WeeklyVolume } from '../types';
import type { WeeklySessionDetail } from '../db/queries';

const PROGRESS_KEY = ['progress'];

export function useExerciseProgress(exerciseId: number, startDate?: Date, endDate?: Date) {
  const userId = useCurrentUserId();
  return useQuery<WeeklyVolume[]>({
    queryKey: [...PROGRESS_KEY, 'exercise', exerciseId, startDate, endDate, userId],
    queryFn: async () => {
      if (!exerciseId) return [];
      
      let whereCondition = eq(sessionExercises.exerciseId, exerciseId);
      
      const dateFilters = [
        startDate ? gte(sessions.startedAt, startDate) : undefined,
        endDate ? lte(sessions.startedAt, endDate) : undefined,
      ].filter(Boolean);
      
      if (dateFilters.length > 0) {
        const dateCondition = and(...dateFilters);
        if (dateCondition) whereCondition = and(whereCondition, dateCondition) ?? whereCondition;
      }

      const result = await db
        .select({
          exerciseId: sessionExercises.exerciseId,
          week: sql<string>`strftime('%Y-%W', ${sessions.startedAt}, 'unixepoch')`,
          totalVolume: sql<number>`coalesce(sum(case when ${sets.completed} = 1 then ${sets.reps} * ${sets.weight} else 0 end), 0)`,
        })
        .from(sets)
        .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
        .innerJoin(sessions, eq(sessionExercises.sessionId, sessions.id))
        .where(
          and(
            whereCondition,
            isNotNull(sessions.completedAt),
            ownedByCurrentUser(sessions.userId)
          )
        )
        .groupBy(sessionExercises.exerciseId, sql`strftime('%Y-%W', ${sessions.startedAt}, 'unixepoch')`);

      return result.map((row) => ({
        week: row.week,
        exerciseId: row.exerciseId,
        exerciseName: '', // Will be populated by caller
        totalVolume: row.totalVolume,
      }));
    },
    enabled: !!exerciseId && !!userId,
  });
}

export function useSessionCountByWeek(exerciseId?: number) {
  const userId = useCurrentUserId();
  return useQuery<ProgressDataPoint[]>({
    queryKey: [...PROGRESS_KEY, 'sessionCount', exerciseId, userId],
    queryFn: async () => {
      let whereCondition = undefined;
      
      if (exerciseId) {
        whereCondition = eq(sessionExercises.exerciseId, exerciseId);
      }

      const result = await db
        .select({
          week: sql<string>`strftime('%Y-%W', ${sessions.startedAt}, 'unixepoch')`,
          count: sql<number>`count(distinct ${sessions.id})`,
        })
        .from(sessions)
        .leftJoin(sessionExercises, eq(sessions.id, sessionExercises.sessionId))
        .where(
          and(
            whereCondition,
            isNotNull(sessions.completedAt),
            ownedByCurrentUser(sessions.userId)
          )
        )
        .groupBy(sql`strftime('%Y-%W', ${sessions.startedAt}, 'unixepoch')`);

      return result.map((row) => ({
        date: row.week,
        value: row.count,
      }));
    },
    enabled: !!userId,
  });
}

export function useTotalVolumeByWeek(exerciseId: number) {
  const userId = useCurrentUserId();
  return useQuery<ProgressDataPoint[]>({
    queryKey: [...PROGRESS_KEY, 'totalVolume', exerciseId, userId],
    queryFn: async () => {
      if (!exerciseId) return [];

      const result = await db
        .select({
          week: sql<string>`strftime('%Y-%W', ${sessions.startedAt}, 'unixepoch')`,
          totalVolume: sql<number>`coalesce(sum(case when ${sets.completed} = 1 then ${sets.reps} * ${sets.weight} else 0 end), 0)`,
        })
        .from(sets)
        .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
        .innerJoin(sessions, eq(sessionExercises.sessionId, sessions.id))
        .where(
          and(
            eq(sessionExercises.exerciseId, exerciseId),
            isNotNull(sessions.completedAt),
            ownedByCurrentUser(sessions.userId)
          )
        )
        .groupBy(sql`strftime('%Y-%W', ${sessions.startedAt}, 'unixepoch')`);

      return result.map((row) => ({
        date: row.week,
        value: row.totalVolume,
      }));
    },
    enabled: !!exerciseId && !!userId,
  });
}

export function useWeeklySessions(week: string | null, exerciseId?: number) {
  const userId = useCurrentUserId();
  return useQuery<WeeklySessionDetail[]>({
    queryKey: [...PROGRESS_KEY, 'weeklySessions', week, exerciseId, userId],
    queryFn: async () => {
      if (!week) return [];
      return getWeeklySessions(week, exerciseId);
    },
    enabled: !!week && !!userId,
  });
}

export function useSessionsByMonth(yearMonth: string) {
  const userId = useCurrentUserId();
  return useQuery<SessionByMonth[]>({
    queryKey: [...PROGRESS_KEY, 'sessionsByMonth', yearMonth, userId],
    queryFn: () => getSessionsByMonth(yearMonth),
    enabled: !!yearMonth && !!userId,
  });
}

export function useMostUsedExercises(limit = 6) {
  const userId = useCurrentUserId();
  return useQuery<MostUsedExercise[]>({
    queryKey: [...PROGRESS_KEY, 'mostUsed', limit, userId],
    queryFn: () => getMostUsedExercises(limit),
    enabled: !!userId,
    refetchOnMount: true,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useSessionMonthIndex() {
  const userId = useCurrentUserId();
  return useQuery<SessionMonthIndexEntry[]>({
    queryKey: [...PROGRESS_KEY, 'monthIndex', userId],
    queryFn: getSessionMonthIndex,
    enabled: !!userId,
  });
}

export function useSessionWithSets(sessionId: number) {
  const userId = useCurrentUserId();
  return useQuery<SessionDetail | null>({
    queryKey: [...PROGRESS_KEY, 'sessionWithSets', sessionId, userId],
    queryFn: () => getSessionWithSets(sessionId),
    enabled: !!sessionId && !!userId,
  });
}

export function useSessionCompare(aId: number, bId: number) {
  const userId = useCurrentUserId();
  return useQuery<SessionCompareResult>({
    queryKey: [...PROGRESS_KEY, 'compare', aId, bId, userId],
    queryFn: () => getSessionCompare(aId, bId),
    enabled: !!aId && !!bId && !!userId,
  });
}

// ─── Routine Period Comparison ────────────────────────

export function useRoutineCompare(
  routineId: number | null,
  routineName: string,
  periods: string[],
  monthLabels?: string[]
) {
  const userId = useCurrentUserId();
  return useQuery<RoutineComparisonData>({
    queryKey: [...PROGRESS_KEY, 'routineCompare', routineId, periods, userId],
    queryFn: async () => {
      if (!routineId) throw new Error('routineId required');
      const rows = await getRoutineSessionsByPeriods(routineId, periods);
      return buildRoutineComparison(routineId, routineName, rows, periods, monthLabels);
    },
    enabled: !!routineId && periods.length > 0 && !!userId,
  });
}