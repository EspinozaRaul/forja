import { useQuery } from '@tanstack/react-query';
import { db } from '../db';
import { sets, sessionExercises, sessions } from '../db/schema';
import { eq, sql, and, gte, lte } from 'drizzle-orm';
import { getWeeklySessions } from '../db/queries';
import { getSessionsByMonth, getSessionMonthIndex, getSessionWithSets, getSessionCompare, getMostUsedExercises, getRoutineSessionsByPeriods, buildRoutineComparison } from '../progress';
import type { SessionByMonth, SessionMonthIndexEntry, SessionDetail, SessionCompareResult, MostUsedExercise, RoutineComparisonData } from '../progress';
import type { ProgressDataPoint, WeeklyVolume } from '../types';
import type { WeeklySessionDetail } from '../db/queries';

const PROGRESS_KEY = ['progress'];

export function useExerciseProgress(exerciseId: number, startDate?: Date, endDate?: Date) {
  return useQuery<WeeklyVolume[]>({
    queryKey: [...PROGRESS_KEY, 'exercise', exerciseId, startDate, endDate],
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
          totalVolume: sql<number>`coalesce(sum(${sets.reps} * ${sets.weight}), 0)`,
        })
        .from(sets)
        .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
        .innerJoin(sessions, eq(sessionExercises.sessionId, sessions.id))
        .where(whereCondition)
        .groupBy(sessionExercises.exerciseId, sql`strftime('%Y-%W', ${sessions.startedAt}, 'unixepoch')`);

      return result.map((row) => ({
        week: row.week,
        exerciseId: row.exerciseId,
        exerciseName: '', // Will be populated by caller
        totalVolume: row.totalVolume,
      }));
    },
    enabled: !!exerciseId,
  });
}

export function useSessionCountByWeek(exerciseId?: number) {
  return useQuery<ProgressDataPoint[]>({
    queryKey: [...PROGRESS_KEY, 'sessionCount', exerciseId],
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
        .where(whereCondition)
        .groupBy(sql`strftime('%Y-%W', ${sessions.startedAt}, 'unixepoch')`);

      return result.map((row) => ({
        date: row.week,
        value: row.count,
      }));
    },
  });
}

export function useTotalVolumeByWeek(exerciseId: number) {
  return useQuery<ProgressDataPoint[]>({
    queryKey: [...PROGRESS_KEY, 'totalVolume', exerciseId],
    queryFn: async () => {
      if (!exerciseId) return [];

      const result = await db
        .select({
          week: sql<string>`strftime('%Y-%W', ${sessions.startedAt}, 'unixepoch')`,
          totalVolume: sql<number>`coalesce(sum(${sets.reps} * ${sets.weight}), 0)`,
        })
        .from(sets)
        .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
        .innerJoin(sessions, eq(sessionExercises.sessionId, sessions.id))
        .where(eq(sessionExercises.exerciseId, exerciseId))
        .groupBy(sql`strftime('%Y-%W', ${sessions.startedAt}, 'unixepoch')`);

      return result.map((row) => ({
        date: row.week,
        value: row.totalVolume,
      }));
    },
    enabled: !!exerciseId,
  });
}

export function useWeeklySessions(week: string | null, exerciseId?: number) {
  return useQuery<WeeklySessionDetail[]>({
    queryKey: [...PROGRESS_KEY, 'weeklySessions', week, exerciseId],
    queryFn: async () => {
      if (!week) return [];
      return getWeeklySessions(week, exerciseId);
    },
    enabled: !!week,
  });
}

export function useSessionsByMonth(yearMonth: string) {
  return useQuery<SessionByMonth[]>({
    queryKey: [...PROGRESS_KEY, 'sessionsByMonth', yearMonth],
    queryFn: () => getSessionsByMonth(yearMonth),
    enabled: !!yearMonth,
  });
}

export function useMostUsedExercises(limit = 6) {
  return useQuery<MostUsedExercise[]>({
    queryKey: [...PROGRESS_KEY, 'mostUsed', limit],
    queryFn: () => getMostUsedExercises(limit),
    refetchOnMount: true,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useSessionMonthIndex() {
  return useQuery<SessionMonthIndexEntry[]>({
    queryKey: [...PROGRESS_KEY, 'monthIndex'],
    queryFn: getSessionMonthIndex,
  });
}

export function useSessionWithSets(sessionId: number) {
  return useQuery<SessionDetail | null>({
    queryKey: [...PROGRESS_KEY, 'sessionWithSets', sessionId],
    queryFn: () => getSessionWithSets(sessionId),
    enabled: !!sessionId,
  });
}

export function useSessionCompare(aId: number, bId: number) {
  return useQuery<SessionCompareResult>({
    queryKey: [...PROGRESS_KEY, 'compare', aId, bId],
    queryFn: () => getSessionCompare(aId, bId),
    enabled: !!aId && !!bId,
  });
}

// ─── Routine Period Comparison ────────────────────────

export function useRoutineCompare(
  routineId: number | null,
  routineName: string,
  periods: string[],
  monthLabels?: string[]
) {
  return useQuery<RoutineComparisonData>({
    queryKey: [...PROGRESS_KEY, 'routineCompare', routineId, periods],
    queryFn: async () => {
      if (!routineId) throw new Error('routineId required');
      const rows = await getRoutineSessionsByPeriods(routineId, periods);
      return buildRoutineComparison(routineId, routineName, rows, periods, monthLabels);
    },
    enabled: !!routineId && periods.length > 0,
  });
}