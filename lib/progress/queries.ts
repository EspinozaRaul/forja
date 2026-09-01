import { eq, desc, asc, sql, and, inArray } from 'drizzle-orm';
import { sessions, sessionExercises, sets, exercises } from '../db/schema';
import { db } from '../db';
import { getSessionById, getSessionExercisesWithSets } from '../db/queries';
import type { Session } from '../types';
import type { SessionExerciseWithSets } from '../db/queries';

export interface SessionByMonth {
  id: number;
  startedAt: Date;
  completedAt: Date | null;
  duration: number | null;
  notes: string | null;
  exerciseCount: number;
  totalVolume: number;
}

export interface SessionMonthIndexEntry {
  yearMonth: string;
  sessionCount: number;
  totalVolume: number;
}

export interface SessionDetail {
  session: Session;
  exercises: SessionExerciseWithSets[];
}

export interface SessionCompareResult {
  a: SessionDetail | null;
  b: SessionDetail | null;
}

// yearMonth format: "YYYY-MM" — matches strftime('%Y-%m') on the unixepoch
// started_at column, the same way getWeeklySessions matches '%Y-%W' (queries.ts).
export async function getSessionsByMonth(yearMonth: string): Promise<SessionByMonth[]> {
  return db
    .select({
      id: sessions.id,
      startedAt: sessions.startedAt,
      completedAt: sessions.completedAt,
      duration: sessions.duration,
      notes: sessions.notes,
      exerciseCount: sql<number>`count(distinct ${sessionExercises.id})`,
      totalVolume: sql<number>`coalesce(sum(${sets.reps} * ${sets.weight}), 0)`,
    })
    .from(sessions)
    .leftJoin(sessionExercises, eq(sessionExercises.sessionId, sessions.id))
    .leftJoin(sets, eq(sets.sessionExerciseId, sessionExercises.id))
    .where(eq(sql`strftime('%Y-%m', ${sessions.startedAt}, 'unixepoch')`, yearMonth))
    .groupBy(sessions.id)
    .orderBy(asc(sessions.startedAt));
}

// Volume math mirrors getGlobalStats (queries.ts:932-1004): sum of reps × weight
// over every set, no completed filter, coalesced to 0. leftJoins keep sessions
// without sets still counted in sessionCount.
export async function getSessionMonthIndex(): Promise<SessionMonthIndexEntry[]> {
  return db
    .select({
      yearMonth: sql<string>`strftime('%Y-%m', ${sessions.startedAt}, 'unixepoch')`,
      sessionCount: sql<number>`count(distinct ${sessions.id})`,
      totalVolume: sql<number>`coalesce(sum(${sets.reps} * ${sets.weight}), 0)`,
    })
    .from(sessions)
    .leftJoin(sessionExercises, eq(sessionExercises.sessionId, sessions.id))
    .leftJoin(sets, eq(sets.sessionExerciseId, sessionExercises.id))
    .groupBy(sql`strftime('%Y-%m', ${sessions.startedAt}, 'unixepoch')`)
    .orderBy(desc(sql`strftime('%Y-%m', ${sessions.startedAt}, 'unixepoch')`));
}

export async function getSessionWithSets(sessionId: number): Promise<SessionDetail | null> {
  const session = (await getSessionById(sessionId))[0];
  if (!session) return null;
  const exercises = await getSessionExercisesWithSets(sessionId);
  return { session, exercises };
}

export async function getSessionCompare(
  sessionAId: number,
  sessionBId: number
): Promise<SessionCompareResult> {
  const [a, b] = await Promise.all([
    getSessionWithSets(sessionAId),
    getSessionWithSets(sessionBId),
  ]);
  return { a, b };
}

export interface MostUsedExercise {
  exerciseId: number;
  name: string;
  unit: string | null;
  sessionCount: number;
  setCount: number;
  maxWeight: number | null;
}

// Most-used exercises across all history, ordered by session count desc (then
// set count as tiebreaker). sessionCount counts distinct sessions containing
// the exercise; setCount and maxWeight only consider completed sets, mirroring
// how volume is tallied elsewhere (compare.ts collectExerciseStats). leftJoin on
// sets keeps exercises that were added but never completed.
export async function getMostUsedExercises(limit = 6): Promise<MostUsedExercise[]> {
  // Step 1: get exercises ranked by session count (no set aggregation in SQL
  // to avoid drizzle CASE WHEN interpolation issues with the boolean column).
  const exercisesRanked = await db
    .select({
      exerciseId: sessionExercises.exerciseId,
      name: exercises.name,
      unit: exercises.unit,
      sessionCount: sql<number>`count(distinct ${sessions.id})`,
    })
    .from(sessionExercises)
    .innerJoin(sessions, eq(sessionExercises.sessionId, sessions.id))
    .innerJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
    .groupBy(sessionExercises.exerciseId)
    .orderBy(desc(sql`count(distinct ${sessions.id})`))
    .limit(limit);

  if (exercisesRanked.length === 0) return [];

  // Step 2: fetch all completed sets for those exercises in one query.
  const exerciseIds = exercisesRanked.map((e) => e.exerciseId);
  const completedSets = await db
    .select({
      exerciseId: sessionExercises.exerciseId,
      weight: sets.weight,
    })
    .from(sets)
    .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
    .where(and(inArray(sessionExercises.exerciseId, exerciseIds), eq(sets.completed, true)));

  // Step 3: aggregate setCount and maxWeight in JS.
  const setsByExercise = new Map<number, { count: number; maxWeight: number | null }>();
  for (const s of completedSets) {
    const entry = setsByExercise.get(s.exerciseId);
    if (entry) {
      entry.count += 1;
      if (s.weight != null && (entry.maxWeight == null || s.weight > entry.maxWeight)) {
        entry.maxWeight = s.weight;
      }
    } else {
      setsByExercise.set(s.exerciseId, { count: 1, maxWeight: s.weight ?? null });
    }
  }

  return exercisesRanked.map((e) => {
    const stats = setsByExercise.get(e.exerciseId);
    return {
      exerciseId: e.exerciseId,
      name: e.name,
      unit: e.unit,
      sessionCount: e.sessionCount,
      setCount: stats?.count ?? 0,
      maxWeight: stats?.maxWeight ?? null,
    };
  });
}