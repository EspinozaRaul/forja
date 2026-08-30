import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { DEFAULT_TARGET_SETS, DEFAULT_TARGET_REPS, DEFAULT_REST_SECONDS } from '../constants/routine-defaults';

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const exercises = sqliteTable('exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  categoryId: integer('category_id').references(() => categories.id),
  description: text('description'),
  // New fields from exercises-dataset
  equipment: text('equipment'),
  targetMuscle: text('target_muscle'),
  muscleGroup: text('muscle_group'),
  bodyPart: text('body_part'), // Dataset category: chest, back, shoulders, etc.
  secondaryMuscles: text('secondary_muscles'), // JSON array
  instructionsEs: text('instructions_es'),
  imageUrl: text('image_url'),
  gifUrl: text('gif_url'),
  originalId: text('original_id'), // ID from dataset for tracking
  unit: text('unit').default('kg'), // kg or lbs per exercise
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (exercises) => ({
  nameCategoryUnique: uniqueIndex('name_category_idx').on(exercises.name, exercises.categoryId),
}));

export const routineFolders = sqliteTable('routine_folders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color').default('#00F5A0'),
  icon: text('icon').default('📁'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const routines = sqliteTable('routines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  categoryId: integer('category_id').references(() => categories.id),
  folderId: integer('folder_id').references(() => routineFolders.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const routineExercises = sqliteTable('routine_exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  routineId: integer('routine_id')
    .references(() => routines.id, { onDelete: 'cascade' })
    .notNull(),
  exerciseId: integer('exercise_id')
    .references(() => exercises.id, { onDelete: 'restrict' })
    .notNull(),
  order: integer('order').notNull(),
  targetSets: integer('target_sets').default(DEFAULT_TARGET_SETS),
  targetReps: integer('target_reps').default(DEFAULT_TARGET_REPS),
});

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  routineId: integer('routine_id').references(() => routines.id, { onDelete: 'set null' }),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  duration: integer('duration'),
  notes: text('notes'),
});

export const sessionExercises = sqliteTable('session_exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: integer('session_id')
    .references(() => sessions.id, { onDelete: 'cascade' })
    .notNull(),
  exerciseId: integer('exercise_id')
    .references(() => exercises.id, { onDelete: 'restrict' })
    .notNull(),
  order: integer('order').notNull(),
  restTime: integer('rest_time').default(DEFAULT_REST_SECONDS), // seconds, per-exercise rest duration
  notes: text('notes'),
  noteType: text('note_type'), // 'rendimiento' | 'ajuste' | null
  supersetPairId: integer('superset_pair_id'), // shared pair id; both exercises of a super set get the same value
}, (table) => ({
  sessionIdx: index('se_session_idx').on(table.sessionId),
  exerciseIdx: index('se_exercise_idx').on(table.exerciseId),
}));

export const sets = sqliteTable('sets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionExerciseId: integer('session_exercise_id')
    .references(() => sessionExercises.id, { onDelete: 'cascade' })
    .notNull(),
  setNumber: integer('set_number').notNull(),
  reps: integer('reps'),
  weight: real('weight'),
  completed: integer('completed', { mode: 'boolean' }).default(false).notNull(),
  // Drop set support
  method: text('method').default('linear'), // SetMethod: 'linear', 'dropset', 'rest_pause', 'cluster', 'superset', 'partial', 'pyramid_up', 'pyramid_down'
  dropOrder: integer('drop_order').default(0), // order within a drop set group (0 = not a drop)
  isDropGroup: integer('is_drop_group', { mode: 'boolean' }).default(false), // true if this set STARTS a drop set
  rir: integer('rir'), // Reps In Reserve: 0 = to failure, 1 = one rep left, etc.
  partialReps: integer('partial_reps'), // Partial reps for 'partial' method (C+P format)
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (table) => ({
  sessionExerciseIdx: index('sets_session_exercise_idx').on(table.sessionExerciseId),
}));
