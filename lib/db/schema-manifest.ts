// The frozen description of the local SQLite schema.
//
// `SCHEMA_MANIFEST` is authored by hand from `lib/db/ddl.ts` — it is the
// contract, not a generated restatement. `__tests__/lib/db/schema-freeze.test.ts`
// reads the real shape back with `PRAGMA table_info` / `PRAGMA index_list` and
// fails if the database drifts from this module.
//
// Bump `SCHEMA_VERSION` whenever the shape changes: a later layer (identity
// columns, etc.) is expected to add a version and extend the manifest with it.

export const SCHEMA_VERSION = 3;

export interface SchemaColumn {
  name: string;
  type: string;
  notNull: number; // PRAGMA table_info `notnull`: 0 | 1
  pk: number; // PRAGMA table_info `pk`: 0 when not part of the primary key
  dfltValue: string | null; // PRAGMA table_info `dflt_value`, SQL literal text
}

export interface SchemaIndex {
  /** Explicit index name, or `null` for a SQLite-implicit UNIQUE autoindex. */
  name: string | null;
  unique: number; // PRAGMA index_list `unique`: 0 | 1
  columns: string[]; // index_info column names, in key order
}

export interface SchemaTable {
  name: string;
  columns: SchemaColumn[]; // declaration order, exactly as `PRAGMA table_info` reports it
  indexes: SchemaIndex[];
}

// Columns that `runSchemaMigrations` adds to databases created before they
// existed. Authored from the ALTER statements in `lib/db/schema-migrations.ts`,
// deliberately NOT by diffing the manifest. `body_part` is intentionally absent:
// its ALTER lives on the early-return branch of `initializeDatabase` (it only
// runs once exercises already exist) and is not part of `runSchemaMigrations`.
export const MIGRATION_ADDED_COLUMNS: Record<string, string[]> = {
  routines: ['folder_id', 'user_id', 'uuid', 'updated_at', 'deleted_at'],
  routine_exercises: ['created_at', 'uuid', 'updated_at', 'deleted_at'],
  session_exercises: ['rest_time', 'superset_pair_id', 'note_type', 'created_at', 'uuid', 'updated_at', 'deleted_at'],
  exercises: ['unit', 'name_es', 'description_es', 'user_id', 'uuid', 'updated_at', 'deleted_at'],
  sets: ['method', 'drop_order', 'is_drop_group', 'rir', 'partial_reps', 'uuid', 'updated_at', 'deleted_at'],
  sessions: ['user_id', 'uuid', 'updated_at', 'deleted_at'],
  routine_folders: ['user_id', 'uuid', 'updated_at', 'deleted_at'],
  body_measurements: ['user_id', 'uuid', 'updated_at', 'deleted_at'],
  progress_photos: ['user_id', 'uuid', 'updated_at', 'deleted_at'],
};

// Indexes that `runSchemaMigrations` creates on databases that predate them.
// Authored from the migration (whose source is `MIGRATION_ADDED_COLUMNS`'s
// companion statement), deliberately NOT by diffing the manifest. Each index is
// the uniqueness the audit asks for on `uuid`: `NOT NULL` stays deferred because
// SQLite cannot `ADD COLUMN ... NOT NULL` without a default, but a UNIQUE index
// still tolerates the shared seed rows whose `uuid` is NULL.
export const MIGRATION_ADDED_INDEXES: Record<string, string[]> = {
  exercises: ['exercises_uuid_idx'],
  routine_folders: ['routine_folders_uuid_idx'],
  routines: ['routines_uuid_idx'],
  routine_exercises: ['routine_exercises_uuid_idx'],
  sessions: ['sessions_uuid_idx'],
  session_exercises: ['session_exercises_uuid_idx'],
  sets: ['sets_uuid_idx'],
  body_measurements: ['body_measurements_uuid_idx'],
  progress_photos: ['progress_photos_uuid_idx'],
};

export const SCHEMA_MANIFEST: SchemaTable[] = [
  {
    name: 'categories',
    columns: [
      { name: 'id', type: 'INTEGER', notNull: 0, pk: 1, dfltValue: null },
      { name: 'name', type: 'TEXT', notNull: 1, pk: 0, dfltValue: null },
      { name: 'color', type: 'TEXT', notNull: 1, pk: 0, dfltValue: null },
      { name: 'icon', type: 'TEXT', notNull: 1, pk: 0, dfltValue: null },
      { name: 'created_at', type: 'INTEGER', notNull: 1, pk: 0, dfltValue: null },
    ],
    indexes: [{ name: null, unique: 1, columns: ['name'] }],
  },
  {
    name: 'exercises',
    columns: [
      { name: 'id', type: 'INTEGER', notNull: 0, pk: 1, dfltValue: null },
      { name: 'user_id', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'name', type: 'TEXT', notNull: 1, pk: 0, dfltValue: null },
      { name: 'name_es', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'category_id', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'description', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'description_es', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'equipment', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'target_muscle', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'muscle_group', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'body_part', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'secondary_muscles', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'instructions_es', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'image_url', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'gif_url', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'original_id', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'unit', type: 'TEXT', notNull: 0, pk: 0, dfltValue: "'kg'" },
      { name: 'created_at', type: 'INTEGER', notNull: 1, pk: 0, dfltValue: null },
      { name: 'uuid', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'updated_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'deleted_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
    ],
    indexes: [
      { name: 'exercises_uuid_idx', unique: 1, columns: ['uuid'] },
      { name: 'name_category_idx', unique: 0, columns: ['name', 'category_id'] },
    ],
  },
  {
    name: 'routine_folders',
    columns: [
      { name: 'id', type: 'INTEGER', notNull: 0, pk: 1, dfltValue: null },
      { name: 'user_id', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'name', type: 'TEXT', notNull: 1, pk: 0, dfltValue: null },
      { name: 'description', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'color', type: 'TEXT', notNull: 0, pk: 0, dfltValue: "'#00F5A0'" },
      { name: 'icon', type: 'TEXT', notNull: 0, pk: 0, dfltValue: "'📁'" },
      { name: 'created_at', type: 'INTEGER', notNull: 1, pk: 0, dfltValue: null },
      { name: 'uuid', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'updated_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'deleted_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
    ],
    indexes: [{ name: 'routine_folders_uuid_idx', unique: 1, columns: ['uuid'] }],
  },
  {
    name: 'routines',
    columns: [
      { name: 'id', type: 'INTEGER', notNull: 0, pk: 1, dfltValue: null },
      { name: 'user_id', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'name', type: 'TEXT', notNull: 1, pk: 0, dfltValue: null },
      { name: 'description', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'category_id', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'folder_id', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'created_at', type: 'INTEGER', notNull: 1, pk: 0, dfltValue: null },
      { name: 'uuid', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'updated_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'deleted_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
    ],
    indexes: [{ name: 'routines_uuid_idx', unique: 1, columns: ['uuid'] }],
  },
  {
    name: 'routine_exercises',
    columns: [
      { name: 'id', type: 'INTEGER', notNull: 0, pk: 1, dfltValue: null },
      { name: 'routine_id', type: 'INTEGER', notNull: 1, pk: 0, dfltValue: null },
      { name: 'exercise_id', type: 'INTEGER', notNull: 1, pk: 0, dfltValue: null },
      { name: 'order', type: 'INTEGER', notNull: 1, pk: 0, dfltValue: null },
      { name: 'target_sets', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: '3' },
      { name: 'target_reps', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: '10' },
      { name: 'created_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'uuid', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'updated_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'deleted_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
    ],
    indexes: [{ name: 'routine_exercises_uuid_idx', unique: 1, columns: ['uuid'] }],
  },
  {
    name: 'sessions',
    columns: [
      { name: 'id', type: 'INTEGER', notNull: 0, pk: 1, dfltValue: null },
      { name: 'user_id', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'routine_id', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'started_at', type: 'INTEGER', notNull: 1, pk: 0, dfltValue: null },
      { name: 'completed_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'duration', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'notes', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'uuid', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'updated_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'deleted_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
    ],
    indexes: [
      { name: 'sessions_completed_at_idx', unique: 0, columns: ['completed_at'] },
      { name: 'sessions_routine_id_idx', unique: 0, columns: ['routine_id'] },
      { name: 'sessions_uuid_idx', unique: 1, columns: ['uuid'] },
    ],
  },
  {
    name: 'session_exercises',
    columns: [
      { name: 'id', type: 'INTEGER', notNull: 0, pk: 1, dfltValue: null },
      { name: 'session_id', type: 'INTEGER', notNull: 1, pk: 0, dfltValue: null },
      { name: 'exercise_id', type: 'INTEGER', notNull: 1, pk: 0, dfltValue: null },
      { name: 'order', type: 'INTEGER', notNull: 1, pk: 0, dfltValue: null },
      { name: 'rest_time', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: '60' },
      { name: 'notes', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'note_type', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'superset_pair_id', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'created_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'uuid', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'updated_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'deleted_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
    ],
    indexes: [
      { name: 'se_exercise_idx', unique: 0, columns: ['exercise_id'] },
      { name: 'se_session_idx', unique: 0, columns: ['session_id'] },
      { name: 'session_exercises_uuid_idx', unique: 1, columns: ['uuid'] },
    ],
  },
  {
    name: 'sets',
    columns: [
      { name: 'id', type: 'INTEGER', notNull: 0, pk: 1, dfltValue: null },
      { name: 'session_exercise_id', type: 'INTEGER', notNull: 1, pk: 0, dfltValue: null },
      { name: 'set_number', type: 'INTEGER', notNull: 1, pk: 0, dfltValue: null },
      { name: 'reps', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'weight', type: 'REAL', notNull: 0, pk: 0, dfltValue: null },
      { name: 'completed', type: 'INTEGER', notNull: 1, pk: 0, dfltValue: '0' },
      { name: 'method', type: 'TEXT', notNull: 0, pk: 0, dfltValue: "'linear'" },
      { name: 'drop_order', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: '0' },
      { name: 'is_drop_group', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: '0' },
      { name: 'rir', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'partial_reps', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'created_at', type: 'INTEGER', notNull: 1, pk: 0, dfltValue: null },
      { name: 'uuid', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'updated_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'deleted_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
    ],
    indexes: [
      { name: 'sets_session_exercise_idx', unique: 0, columns: ['session_exercise_id'] },
      { name: 'sets_uuid_idx', unique: 1, columns: ['uuid'] },
    ],
  },
  {
    name: 'body_measurements',
    columns: [
      { name: 'id', type: 'INTEGER', notNull: 0, pk: 1, dfltValue: null },
      { name: 'user_id', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'date', type: 'INTEGER', notNull: 1, pk: 0, dfltValue: null },
      { name: 'weight', type: 'REAL', notNull: 0, pk: 0, dfltValue: null },
      { name: 'body_fat', type: 'REAL', notNull: 0, pk: 0, dfltValue: null },
      { name: 'chest', type: 'REAL', notNull: 0, pk: 0, dfltValue: null },
      { name: 'waist', type: 'REAL', notNull: 0, pk: 0, dfltValue: null },
      { name: 'hips', type: 'REAL', notNull: 0, pk: 0, dfltValue: null },
      { name: 'arms', type: 'REAL', notNull: 0, pk: 0, dfltValue: null },
      { name: 'thighs', type: 'REAL', notNull: 0, pk: 0, dfltValue: null },
      { name: 'notes', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'created_at', type: 'INTEGER', notNull: 1, pk: 0, dfltValue: null },
      { name: 'uuid', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'updated_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'deleted_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
    ],
    indexes: [{ name: 'body_measurements_uuid_idx', unique: 1, columns: ['uuid'] }],
  },
  {
    name: 'progress_photos',
    columns: [
      { name: 'id', type: 'INTEGER', notNull: 0, pk: 1, dfltValue: null },
      { name: 'user_id', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'date', type: 'INTEGER', notNull: 1, pk: 0, dfltValue: null },
      { name: 'uri', type: 'TEXT', notNull: 1, pk: 0, dfltValue: null },
      { name: 'body_part', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'created_at', type: 'INTEGER', notNull: 1, pk: 0, dfltValue: null },
      { name: 'uuid', type: 'TEXT', notNull: 0, pk: 0, dfltValue: null },
      { name: 'updated_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
      { name: 'deleted_at', type: 'INTEGER', notNull: 0, pk: 0, dfltValue: null },
    ],
    indexes: [{ name: 'progress_photos_uuid_idx', unique: 1, columns: ['uuid'] }],
  },
];
