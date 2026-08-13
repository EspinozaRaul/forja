import { eq, desc, asc, sql, and, gte, lte } from 'drizzle-orm';
import {
  categories,
  exercises,
  routines,
  routineExercises,
  routineFolders,
  sessions,
  sessionExercises,
  sets,
} from './schema';
import { db } from './index';

// ─── Categories ────────────────────────────────────────

export async function getAllCategories() {
  return db.select().from(categories);
}

export async function getCategoryById(id: number) {
  return db.select().from(categories).where(eq(categories.id, id)).limit(1);
}

export async function createCategory(data: {
  name: string;
  color: string;
  icon: string;
}) {
  return db
    .insert(categories)
    .values({ ...data, createdAt: new Date() })
    .returning();
}

// ─── Routine Folders ───────────────────────────────────

export async function getAllFolders() {
  return db.select().from(routineFolders).orderBy(desc(routineFolders.createdAt));
}

export async function getFolderById(id: number) {
  return db.select().from(routineFolders).where(eq(routineFolders.id, id)).limit(1);
}

export async function getRoutinesByFolder(folderId: number) {
  return db
    .select()
    .from(routines)
    .where(eq(routines.folderId, folderId))
    .orderBy(desc(routines.createdAt));
}

export async function getFolderRoutineCount(folderId: number) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(routines)
    .where(eq(routines.folderId, folderId));
  return result[0]?.count ?? 0;
}

export async function createFolder(data: {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}) {
  return db
    .insert(routineFolders)
    .values({ ...data, createdAt: new Date() })
    .returning();
}

export async function updateFolder(
  id: number,
  data: { name?: string; description?: string; color?: string; icon?: string }
) {
  return db
    .update(routineFolders)
    .set(data)
    .where(eq(routineFolders.id, id))
    .returning();
}

export async function deleteFolder(id: number) {
  // Unlink routines from this folder (set folderId to null)
  await db
    .update(routines)
    .set({ folderId: null })
    .where(eq(routines.folderId, id));
  return db.delete(routineFolders).where(eq(routineFolders.id, id));
}

// ─── Exercises ─────────────────────────────────────────

export async function getAllExercises() {
  return db.select().from(exercises);
}

export async function getExercisesByCategory(categoryId: number) {
  return db
    .select()
    .from(exercises)
    .where(eq(exercises.categoryId, categoryId));
}

export async function getExerciseById(id: number) {
  return db.select().from(exercises).where(eq(exercises.id, id)).limit(1);
}

export async function createExercise(data: {
  name: string;
  categoryId: number;
  description?: string;
}) {
  return db
    .insert(exercises)
    .values({ ...data, createdAt: new Date() })
    .returning();
}

export async function updateExercise(
  id: number,
  data: { name?: string; categoryId?: number; description?: string; unit?: string }
) {
  return db
    .update(exercises)
    .set(data)
    .where(eq(exercises.id, id))
    .returning();
}

export async function deleteExercise(id: number) {
  return db.delete(exercises).where(eq(exercises.id, id));
}

// ─── Routines ──────────────────────────────────────────

export async function getAllRoutines() {
  return db.select().from(routines);
}

export async function getRoutineById(id: number) {
  return db.select().from(routines).where(eq(routines.id, id)).limit(1);
}

export async function createRoutine(data: {
  name: string;
  description?: string;
  categoryId?: number;
  folderId?: number;
}) {
  return db
    .insert(routines)
    .values({ ...data, createdAt: new Date() })
    .returning();
}

export async function updateRoutine(
  id: number,
  data: { name?: string; description?: string; categoryId?: number; folderId?: number }
) {
  return db
    .update(routines)
    .set(data)
    .where(eq(routines.id, id))
    .returning();
}

export async function deleteRoutine(id: number) {
  return db.delete(routines).where(eq(routines.id, id));
}

// ─── Routine Exercises ─────────────────────────────────

export async function getRoutineExercises(routineId: number) {
  return db
    .select()
    .from(routineExercises)
    .where(eq(routineExercises.routineId, routineId));
}

export async function addExerciseToRoutine(data: {
  routineId: number;
  exerciseId: number;
  order: number;
  targetSets?: number;
  targetReps?: number;
}) {
  return db.insert(routineExercises).values(data).returning();
}

export async function removeExerciseFromRoutine(id: number) {
  return db.delete(routineExercises).where(eq(routineExercises.id, id));
}

export async function updateRoutineExerciseOrder(id: number, order: number) {
  return db
    .update(routineExercises)
    .set({ order })
    .where(eq(routineExercises.id, id))
    .returning();
}

export async function replaceRoutineExercise(id: number, exerciseId: number) {
  return db
    .update(routineExercises)
    .set({ exerciseId })
    .where(eq(routineExercises.id, id))
    .returning();
}

// ─── Sessions ──────────────────────────────────────────

export async function getAllSessions() {
  return db.select().from(sessions).orderBy(desc(sessions.startedAt));
}

export async function getSessionById(id: number) {
  return db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
}

export async function createSession(data: {
  routineId?: number;
  startedAt?: Date;
}) {
  return db
    .insert(sessions)
    .values({ ...data, startedAt: data.startedAt ?? new Date() })
    .returning();
}

export async function completeSession(
  id: number,
  data: { completedAt?: Date; duration?: number; notes?: string }
) {
  return db
    .update(sessions)
    .set({ ...data, completedAt: data.completedAt ?? new Date() })
    .where(eq(sessions.id, id))
    .returning();
}

export async function deleteSession(id: number) {
  return db.delete(sessions).where(eq(sessions.id, id));
}

// ─── Session Exercises ─────────────────────────────────

export async function getSessionExercises(sessionId: number) {
  return db
    .select()
    .from(sessionExercises)
    .where(eq(sessionExercises.sessionId, sessionId));
}

export async function addExerciseToSession(data: {
  sessionId: number;
  exerciseId: number;
  order: number;
  notes?: string;
}) {
  return db.insert(sessionExercises).values(data).returning();
}

export async function updateSessionExerciseRestTime(
  id: number,
  restTime: number
) {
  return db
    .update(sessionExercises)
    .set({ restTime })
    .where(eq(sessionExercises.id, id))
    .returning();
}

export async function updateSessionExerciseOrder(id: number, order: number) {
  return db
    .update(sessionExercises)
    .set({ order })
    .where(eq(sessionExercises.id, id))
    .returning();
}

export async function replaceSessionExercise(id: number, exerciseId: number) {
  return db
    .update(sessionExercises)
    .set({ exerciseId })
    .where(eq(sessionExercises.id, id))
    .returning();
}

export async function deleteSessionExercise(id: number) {
  return db.delete(sessionExercises).where(eq(sessionExercises.id, id));
}

export async function createSuperSetPair(firstId: number, secondId: number) {
  // Generate a new unique pair id (use a timestamp-based value; enough for local app)
  const pairId = Date.now();
  await db.update(sessionExercises).set({ supersetPairId: pairId }).where(eq(sessionExercises.id, firstId));
  await db.update(sessionExercises).set({ supersetPairId: pairId }).where(eq(sessionExercises.id, secondId));

  // Balance series between both sides: a super set cycle needs a set on EACH side with the same
  // setNumber. If one exercise already had sets before pairing (e.g. Press had serie 1 and the
  // paired Remo has none), create empty matching sets on the side that's missing them.
  const [setsFirst, setsSecond] = await Promise.all([
    db.select({ setNumber: sets.setNumber }).from(sets).where(eq(sets.sessionExerciseId, firstId)),
    db.select({ setNumber: sets.setNumber }).from(sets).where(eq(sets.sessionExerciseId, secondId)),
  ]);
  const firstNumbers = new Set(setsFirst.map((s) => s.setNumber));
  const secondNumbers = new Set(setsSecond.map((s) => s.setNumber));
  const allNumbers = new Set([...firstNumbers, ...secondNumbers]);

  for (const setNumber of allNumbers) {
    if (!firstNumbers.has(setNumber)) {
      await db.insert(sets).values({ sessionExerciseId: firstId, setNumber, completed: false, createdAt: new Date() });
    }
    if (!secondNumbers.has(setNumber)) {
      await db.insert(sets).values({ sessionExerciseId: secondId, setNumber, completed: false, createdAt: new Date() });
    }
  }

  return pairId;
}

export async function unlinkSuperSetPair(pairId: number) {
  return db
    .update(sessionExercises)
    .set({ supersetPairId: null })
    .where(eq(sessionExercises.supersetPairId, pairId));
}

// ─── Sets ──────────────────────────────────────────────

export async function getSetsForSessionExercise(sessionExerciseId: number) {
  return db
    .select()
    .from(sets)
    .where(eq(sets.sessionExerciseId, sessionExerciseId))
    .orderBy(asc(sets.setNumber), asc(sets.dropOrder));
}

export async function createSet(data: {
  sessionExerciseId: number;
  setNumber: number;
  reps?: number;
  weight?: number;
  method?: string;
  dropOrder?: number;
  isDropGroup?: boolean;
  rir?: number;
}) {
  return db
    .insert(sets)
    .values({
      ...data,
      completed: false,
      createdAt: new Date(),
    })
    .returning();
}

export async function createDropSets(data: {
  sessionExerciseId: number;
  setNumber: number;
  method?: string;
  drops: Array<{ reps?: number; weight?: number; rir?: number }>;
}) {
  const results: any[] = [];

  for (let i = 0; i < data.drops.length; i++) {
    const drop = data.drops[i];
    const result = await db
      .insert(sets)
      .values({
        sessionExerciseId: data.sessionExerciseId,
        setNumber: data.setNumber,
        reps: drop.reps,
        weight: drop.weight,
        completed: false,
        method: data.method ?? 'dropset',
        dropOrder: i + 1,
        isDropGroup: i === 0,
        rir: drop.rir,
        createdAt: new Date(),
      })
      .returning();
    results.push(result[0]);
  }

  return results;
}

export async function updateSet(
  id: number,
  data: {
    reps?: number;
    weight?: number;
    completed?: boolean;
    rir?: number;
  }
) {
  return db.update(sets).set(data).where(eq(sets.id, id)).returning();
}

export async function deleteSet(id: number) {
  return db.delete(sets).where(eq(sets.id, id));
}

export async function deleteDropSetGroup(sessionExerciseId: number, setNumber: number) {
  return db
    .delete(sets)
    .where(and(eq(sets.sessionExerciseId, sessionExerciseId), eq(sets.setNumber, setNumber)));
}

// ─── Last Session for Routine ──────────────────────────

export async function getLastSessionForRoutine(routineId: number) {
  const lastSession = await db
    .select()
    .from(sessions)
    .where(eq(sessions.routineId, routineId))
    .orderBy(desc(sessions.completedAt))
    .limit(1);

  if (lastSession.length === 0) return null;

  const sessionExercisesData = await db
    .select({
      id: sessionExercises.id,
      sessionId: sessionExercises.sessionId,
      exerciseId: sessionExercises.exerciseId,
      order: sessionExercises.order,
      restTime: sessionExercises.restTime,
      notes: sessionExercises.notes,
      supersetPairId: sessionExercises.supersetPairId,
      exerciseName: exercises.name,
    })
    .from(sessionExercises)
    .leftJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
    .where(eq(sessionExercises.sessionId, lastSession[0].id));

  const exercisesWithSets = await Promise.all(
    sessionExercisesData.map(async (se) => {
      const setsData = await db
        .select()
        .from(sets)
        .where(eq(sets.sessionExerciseId, se.id));
      return { ...se, sets: setsData };
    })
  );

  return { ...lastSession[0], exercises: exercisesWithSets };
}

// ─── Duplicate Session Data ────────────────────────────

export async function duplicateSessionData(
  sourceSessionId: number,
  targetSessionId: number
) {
  const sourceExercises = await db
    .select()
    .from(sessionExercises)
    .where(eq(sessionExercises.sessionId, sourceSessionId));

  for (const se of sourceExercises) {
    const newExercise = await db
      .insert(sessionExercises)
      .values({
        sessionId: targetSessionId,
        exerciseId: se.exerciseId,
        order: se.order,
        notes: se.notes,
        supersetPairId: se.supersetPairId,
      })
      .returning();

    const sourceSets = await db
      .select()
      .from(sets)
      .where(eq(sets.sessionExerciseId, se.id));

    for (const s of sourceSets) {
      await db.insert(sets).values({
        sessionExerciseId: newExercise[0].id,
        setNumber: s.setNumber,
        reps: s.reps,
        weight: s.weight,
        completed: false,
        method: s.method,
        dropOrder: s.dropOrder,
        isDropGroup: s.isDropGroup,
        rir: s.rir,
        createdAt: new Date(),
      });
    }
  }
}

// ─── Exercise History ──────────────────────────────────

export async function getSetsByExerciseId(exerciseId: number) {
  return db
    .select({
      id: sets.id,
      sessionExerciseId: sets.sessionExerciseId,
      setNumber: sets.setNumber,
      reps: sets.reps,
      weight: sets.weight,
      completed: sets.completed,
      method: sets.method,
      dropOrder: sets.dropOrder,
      isDropGroup: sets.isDropGroup,
      rir: sets.rir,
      createdAt: sets.createdAt,
      sessionId: sessionExercises.sessionId,
      exerciseId: sessionExercises.exerciseId,
    })
    .from(sets)
    .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
    .where(eq(sessionExercises.exerciseId, exerciseId));
}

// ─── Exercise Stats ────────────────────────────────────

export interface ExerciseStats {
  maxWeight: number | null;
  totalVolume: number;
  totalSessions: number;
  totalSets: number;
}

export async function getExerciseStats(exerciseId: number): Promise<ExerciseStats> {
  const result = await db
    .select({
      maxWeight: sql<number | null>`max(${sets.weight})`,
      totalVolume: sql<number>`coalesce(sum(${sets.reps} * ${sets.weight}), 0)`,
      totalSets: sql<number>`count(${sets.id})`,
    })
    .from(sets)
    .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
    .where(eq(sessionExercises.exerciseId, exerciseId));

  const sessionCount = await db
    .select({ count: sql<number>`count(distinct ${sessionExercises.sessionId})` })
    .from(sessionExercises)
    .where(eq(sessionExercises.exerciseId, exerciseId));

  return {
    maxWeight: result[0]?.maxWeight ?? null,
    totalVolume: result[0]?.totalVolume ?? 0,
    totalSessions: sessionCount[0]?.count ?? 0,
    totalSets: result[0]?.totalSets ?? 0,
  };
}

// ─── Exercise Sessions History ─────────────────────────

export interface ExerciseSessionEntry {
  sessionId: number;
  startedAt: Date;
  duration: number | null;
  volume: number;
  setCount: number;
  completedSets: number;
}

export async function getExerciseSessions(exerciseId: number): Promise<ExerciseSessionEntry[]> {
  const results = await db
    .select({
      sessionId: sessions.id,
      startedAt: sessions.startedAt,
      duration: sessions.duration,
      volume: sql<number>`coalesce(sum(${sets.reps} * ${sets.weight}), 0)`,
      setCount: sql<number>`count(${sets.id})`,
      completedSets: sql<number>`sum(case when ${sets.completed} = 1 then 1 else 0 end)`,
    })
    .from(sessions)
    .innerJoin(sessionExercises, eq(sessionExercises.sessionId, sessions.id))
    .innerJoin(sets, eq(sets.sessionExerciseId, sessionExercises.id))
    .where(eq(sessionExercises.exerciseId, exerciseId))
    .groupBy(sessions.id)
    .orderBy(desc(sessions.startedAt));

  return results.map((r) => ({
    sessionId: r.sessionId,
    startedAt: r.startedAt,
    duration: r.duration,
    volume: r.volume,
    setCount: r.setCount,
    completedSets: r.completedSets,
  }));
}

// ─── Exercise Personal Records ─────────────────────────

export interface ExercisePRs {
  maxWeight: { value: number; date: Date } | null;
  bestSet: { weight: number; reps: number; volume: number; date: Date } | null;
  maxVolumeSession: { volume: number; date: Date; sessionId: number } | null;
  estimated1RM: number | null;
}

export async function getExercisePRs(exerciseId: number): Promise<ExercisePRs> {
  // Max Weight — heaviest single set
  const maxWeightResult = await db
    .select({
      value: sets.weight,
      date: sets.createdAt,
    })
    .from(sets)
    .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
    .where(eq(sessionExercises.exerciseId, exerciseId))
    .orderBy(desc(sets.weight))
    .limit(1);

  // Best Set — highest volume (weight × reps) in a single set
  const bestSetResult = await db
    .select({
      weight: sets.weight,
      reps: sets.reps,
      volume: sql<number>`${sets.weight} * ${sets.reps}`,
      date: sets.createdAt,
    })
    .from(sets)
    .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
    .where(eq(sessionExercises.exerciseId, exerciseId))
    .orderBy(desc(sql`${sets.weight} * ${sets.reps}`))
    .limit(1);

  // Max Volume Session — session with highest total volume
  const maxVolumeSessionResult = await db
    .select({
      volume: sql<number>`coalesce(sum(${sets.reps} * ${sets.weight}), 0)`,
      date: sessions.startedAt,
      sessionId: sessions.id,
    })
    .from(sessions)
    .innerJoin(sessionExercises, eq(sessionExercises.sessionId, sessions.id))
    .innerJoin(sets, eq(sets.sessionExerciseId, sessionExercises.id))
    .where(eq(sessionExercises.exerciseId, exerciseId))
    .groupBy(sessions.id)
    .orderBy(desc(sql`sum(${sets.reps} * ${sets.weight})`))
    .limit(1);

  // Estimated 1RM using Epley formula: weight × (1 + reps/30)
  // Only valid for sets with reps > 1
  const bestFor1RM = bestSetResult[0];
  const estimated1RM = bestFor1RM && bestFor1RM.reps && bestFor1RM.weight
    ? Math.round(bestFor1RM.weight * (1 + bestFor1RM.reps / 30))
    : null;

  return {
    maxWeight: maxWeightResult[0]?.value != null
      ? { value: maxWeightResult[0].value, date: maxWeightResult[0].date }
      : null,
    bestSet: bestSetResult[0]?.weight != null
      ? {
          weight: bestSetResult[0].weight,
          reps: bestSetResult[0].reps ?? 0,
          volume: bestSetResult[0].volume,
          date: bestSetResult[0].date,
        }
      : null,
    maxVolumeSession: maxVolumeSessionResult[0]?.volume != null
      ? {
          volume: maxVolumeSessionResult[0].volume,
          date: maxVolumeSessionResult[0].date,
          sessionId: maxVolumeSessionResult[0].sessionId,
        }
      : null,
    estimated1RM,
  };
}

// ─── Global Stats ──────────────────────────────────────

export interface GlobalStats {
  totalWorkouts: number;
  totalVolume: number;
  totalTime: number;
  currentStreak: number;
  mostFrequentExercise: string | null;
}

export async function getGlobalStats(): Promise<GlobalStats> {
  // Total workouts
  const totalWorkouts = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessions);

  // Total volume (sum of all reps × weight)
  const totalVolume = await db
    .select({ total: sql<number>`coalesce(sum(${sets.reps} * ${sets.weight}), 0)` })
    .from(sets)
    .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id));

  // Total time (sum of all session durations)
  const totalTime = await db
    .select({ total: sql<number>`coalesce(sum(${sessions.duration}), 0)` })
    .from(sessions);

  // Current streak — consecutive days with at least one session
  const recentSessions = await db
    .select({ startedAt: sessions.startedAt })
    .from(sessions)
    .orderBy(desc(sessions.startedAt))
    .limit(30);

  let streak = 0;
  if (recentSessions.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sessionDates = recentSessions.map((s) => {
      const d = new Date(s.startedAt);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    });
    const uniqueDates = [...new Set(sessionDates)].sort((a, b) => b - a);

    // Check if today or yesterday has a session (streak can start from today or yesterday)
    const dayMs = 86400000;
    const latestDate = uniqueDates[0];
    const diffFromToday = today.getTime() - latestDate;

    if (diffFromToday <= dayMs) {
      streak = 1;
      for (let i = 1; i < uniqueDates.length; i++) {
        const prevDiff = uniqueDates[i - 1] - uniqueDates[i];
        if (prevDiff === dayMs) {
          streak++;
        } else {
          break;
        }
      }
    }
  }

  // Most frequent exercise
  const mostFrequent = await db
    .select({
      name: exercises.name,
      count: sql<number>`count(*)`,
    })
    .from(sessionExercises)
    .innerJoin(exercises, eq(sessionExercises.exerciseId, exercises.id))
    .groupBy(sessionExercises.exerciseId)
    .orderBy(desc(sql`count(*)`))
    .limit(1);

  return {
    totalWorkouts: totalWorkouts[0]?.count ?? 0,
    totalVolume: totalVolume[0]?.total ?? 0,
    totalTime: totalTime[0]?.total ?? 0,
    currentStreak: streak,
    mostFrequentExercise: mostFrequent[0]?.name ?? null,
  };
}

// ─── Weekly Sessions Detail ────────────────────────────

export interface WeeklySessionDetail {
  sessionId: number;
  startedAt: Date;
  duration: number | null;
  exerciseCount: number;
  totalVolume: number;
}

export async function getWeeklySessions(week: string, exerciseId?: number): Promise<WeeklySessionDetail[]> {
  // week format: "2026-29" (YYYY-WW) — matches strftime('%Y-%W')
  // Use SQLite strftime to match the same week format as the charts
  
  if (exerciseId) {
    // Filter to only sessions containing this exercise
    return db
      .select({
        sessionId: sessions.id,
        startedAt: sessions.startedAt,
        duration: sessions.duration,
        exerciseCount: sql<number>`count(distinct ${sessionExercises.exerciseId})`,
        totalVolume: sql<number>`coalesce(sum(${sets.reps} * ${sets.weight}), 0)`,
      })
      .from(sessions)
      .innerJoin(sessionExercises, eq(sessionExercises.sessionId, sessions.id))
      .innerJoin(sets, eq(sets.sessionExerciseId, sessionExercises.id))
      .where(
        and(
          eq(sql`strftime('%Y-%W', ${sessions.startedAt}, 'unixepoch')`, week),
          eq(sessionExercises.exerciseId, exerciseId)
        )
      )
      .groupBy(sessions.id)
      .orderBy(desc(sessions.startedAt));
  }

  return db
    .select({
      sessionId: sessions.id,
      startedAt: sessions.startedAt,
      duration: sessions.duration,
      exerciseCount: sql<number>`count(distinct ${sessionExercises.exerciseId})`,
      totalVolume: sql<number>`coalesce(sum(${sets.reps} * ${sets.weight}), 0)`,
    })
    .from(sessions)
    .leftJoin(sessionExercises, eq(sessionExercises.sessionId, sessions.id))
    .leftJoin(sets, eq(sets.sessionExerciseId, sessionExercises.id))
    .where(eq(sql`strftime('%Y-%W', ${sessions.startedAt}, 'unixepoch')`, week))
    .groupBy(sessions.id)
    .orderBy(desc(sessions.startedAt));
}
