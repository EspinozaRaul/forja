// Idempotent column migrations for local SQLite databases.
//
// These are the `ALTER TABLE ... ADD COLUMN` statements that used to live inline
// in `initializeDatabase`. They are kept verbatim and in the same order, and each
// one keeps the original swallow-all `try/catch`: re-running it for a column that
// already exists throws "duplicate column name", which is expected and ignored.
//
// `exercises.body_part` is deliberately NOT here: its ALTER lives on the
// early-return branch of `initializeDatabase` (it only runs once exercises
// already exist) and moving it would change when it executes.

/** Minimal database surface these migrations need: `execSync`. */
export interface SchemaMigrationDatabase {
  execSync(sql: string): void;
}

export function runSchemaMigrations(database: SchemaMigrationDatabase): void {
  const addColumn = (sql: string): void => {
    try {
      database.execSync(sql);
    } catch {
      // Column already exists, ignore.
    }
  };

  addColumn(
    'ALTER TABLE routines ADD COLUMN folder_id INTEGER REFERENCES routine_folders(id) ON DELETE SET NULL'
  );
  addColumn('ALTER TABLE session_exercises ADD COLUMN rest_time INTEGER DEFAULT 60');
  addColumn('ALTER TABLE session_exercises ADD COLUMN superset_pair_id INTEGER');
  addColumn("ALTER TABLE exercises ADD COLUMN unit TEXT DEFAULT 'kg'");
  addColumn("ALTER TABLE sets ADD COLUMN method TEXT DEFAULT 'linear'");
  addColumn('ALTER TABLE sets ADD COLUMN drop_order INTEGER DEFAULT 0');
  addColumn('ALTER TABLE sets ADD COLUMN is_drop_group INTEGER DEFAULT 0');
  addColumn('ALTER TABLE sets ADD COLUMN rir INTEGER');
  addColumn('ALTER TABLE sets ADD COLUMN partial_reps INTEGER');
  addColumn('ALTER TABLE session_exercises ADD COLUMN note_type TEXT');
  addColumn('ALTER TABLE exercises ADD COLUMN name_es TEXT');
  addColumn('ALTER TABLE exercises ADD COLUMN description_es TEXT');
  addColumn('ALTER TABLE sessions ADD COLUMN user_id TEXT');
  addColumn('ALTER TABLE routines ADD COLUMN user_id TEXT');
  addColumn('ALTER TABLE routine_folders ADD COLUMN user_id TEXT');
  addColumn('ALTER TABLE body_measurements ADD COLUMN user_id TEXT');
  addColumn('ALTER TABLE progress_photos ADD COLUMN user_id TEXT');
  addColumn('ALTER TABLE exercises ADD COLUMN user_id TEXT');

  // Unit 2 identity layer (U2a): nullable cross-system identity, versioning and
  // tombstone columns. Nothing reads or writes them yet; a later unit backfills
  // and enforces the app-level invariants.
  addColumn('ALTER TABLE exercises ADD COLUMN uuid TEXT');
  addColumn('ALTER TABLE exercises ADD COLUMN updated_at INTEGER');
  addColumn('ALTER TABLE exercises ADD COLUMN deleted_at INTEGER');
  addColumn('ALTER TABLE routine_folders ADD COLUMN uuid TEXT');
  addColumn('ALTER TABLE routine_folders ADD COLUMN updated_at INTEGER');
  addColumn('ALTER TABLE routine_folders ADD COLUMN deleted_at INTEGER');
  addColumn('ALTER TABLE routines ADD COLUMN uuid TEXT');
  addColumn('ALTER TABLE routines ADD COLUMN updated_at INTEGER');
  addColumn('ALTER TABLE routines ADD COLUMN deleted_at INTEGER');
  addColumn('ALTER TABLE routine_exercises ADD COLUMN created_at INTEGER');
  addColumn('ALTER TABLE routine_exercises ADD COLUMN uuid TEXT');
  addColumn('ALTER TABLE routine_exercises ADD COLUMN updated_at INTEGER');
  addColumn('ALTER TABLE routine_exercises ADD COLUMN deleted_at INTEGER');
  addColumn('ALTER TABLE sessions ADD COLUMN uuid TEXT');
  addColumn('ALTER TABLE sessions ADD COLUMN updated_at INTEGER');
  addColumn('ALTER TABLE sessions ADD COLUMN deleted_at INTEGER');
  addColumn('ALTER TABLE session_exercises ADD COLUMN created_at INTEGER');
  addColumn('ALTER TABLE session_exercises ADD COLUMN uuid TEXT');
  addColumn('ALTER TABLE session_exercises ADD COLUMN updated_at INTEGER');
  addColumn('ALTER TABLE session_exercises ADD COLUMN deleted_at INTEGER');
  addColumn('ALTER TABLE sets ADD COLUMN uuid TEXT');
  addColumn('ALTER TABLE sets ADD COLUMN updated_at INTEGER');
  addColumn('ALTER TABLE sets ADD COLUMN deleted_at INTEGER');
  addColumn('ALTER TABLE body_measurements ADD COLUMN uuid TEXT');
  addColumn('ALTER TABLE body_measurements ADD COLUMN updated_at INTEGER');
  addColumn('ALTER TABLE body_measurements ADD COLUMN deleted_at INTEGER');
  addColumn('ALTER TABLE progress_photos ADD COLUMN uuid TEXT');
  addColumn('ALTER TABLE progress_photos ADD COLUMN updated_at INTEGER');
  addColumn('ALTER TABLE progress_photos ADD COLUMN deleted_at INTEGER');
}
