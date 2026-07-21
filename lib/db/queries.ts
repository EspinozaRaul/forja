import { eq, desc } from 'drizzle-orm';
import {
  categories,
  exercises,
  routines,
  routineExercises,
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
  data: { name?: string; categoryId?: number; description?: string }
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
}) {
  return db
    .insert(routines)
    .values({ ...data, createdAt: new Date() })
    .returning();
}

export async function updateRoutine(
  id: number,
  data: { name?: string; description?: string; categoryId?: number }
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

// ─── Sets ──────────────────────────────────────────────

export async function getSetsForSessionExercise(sessionExerciseId: number) {
  return db
    .select()
    .from(sets)
    .where(eq(sets.sessionExerciseId, sessionExerciseId));
}

export async function createSet(data: {
  sessionExerciseId: number;
  setNumber: number;
  reps?: number;
  weight?: number;
}) {
  return db
    .insert(sets)
    .values({ ...data, completed: false, createdAt: new Date() })
    .returning();
}

export async function updateSet(
  id: number,
  data: {
    reps?: number;
    weight?: number;
    completed?: boolean;
  }
) {
  return db.update(sets).set(data).where(eq(sets.id, id)).returning();
}

export async function deleteSet(id: number) {
  return db.delete(sets).where(eq(sets.id, id));
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
      createdAt: sets.createdAt,
      sessionId: sessionExercises.sessionId,
      exerciseId: sessionExercises.exerciseId,
    })
    .from(sets)
    .innerJoin(sessionExercises, eq(sets.sessionExerciseId, sessionExercises.id))
    .where(eq(sessionExercises.exerciseId, exerciseId));
}
