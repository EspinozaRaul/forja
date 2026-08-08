import { useQuery } from '@tanstack/react-query';
import { db } from '../db';
import { sets, sessionExercises, sessions } from '../db/schema';
import { eq, sql, and, gte, lte } from 'drizzle-orm';
import { getWeeklySessions } from '../db/queries';
import type { ProgressDataPoint, WeeklyVolume } from '../types';
import type { WeeklySessionDetail } from '../db/queries';

const PROGRESS_KEY = ['progress'];

export function useExerciseProgress(exerciseId: number, startDate?: Date, endDate?: Date) {
  return useQuery<WeeklyVolume[]>({
    queryKey: [...PROGRESS_KEY, 'exercise', exerciseId, startDate, endDate],
    queryFn: async () => {
      if (!exerciseId) return [];
      
      let whereCondition = eq(sessionExercises.exerciseId, exerciseId);
      
      if (startDate) {
        whereCondition = and(whereCondition, gte(sessions.startedAt, startDate))!;
      }
      if (endDate) {
        whereCondition = and(whereCondition, lte(sessions.startedAt, endDate))!;
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
    queryFn: () => getWeeklySessions(week!, exerciseId),
    enabled: !!week,
  });
}