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
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
}, (exercises) => ({
  nameCategoryUnique: uniqueIndex('name_category_idx').on(exercises.name, exercises.categoryId),
}));

export const routines = sqliteTable('routines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  categoryId: integer('category_id').references(() => categories.id),
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
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
