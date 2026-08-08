import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
    .references(() => exercises.id)
    .notNull(),
  order: integer('order').notNull(),
  targetSets: integer('target_sets').default(3),
  targetReps: integer('target_reps').default(10),
});

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  routineId: integer('routine_id').references(() => routines.id),
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
    .references(() => exercises.id)
    .notNull(),
  order: integer('order').notNull(),
  restTime: integer('rest_time').default(60), // seconds, per-exercise rest duration
  notes: text('notes'),
});

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
  method: text('method').default('linear'), // 'linear', 'dropset', 'superset', 'pyramid_up', 'pyramid_down'
  dropOrder: integer('drop_order').default(0), // order within a drop set group (0 = not a drop)
  isDropGroup: integer('is_drop_group', { mode: 'boolean' }).default(false), // true if this set STARTS a drop set
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
