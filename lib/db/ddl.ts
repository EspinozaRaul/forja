// Table DDL for the local SQLite database.
//
// Lives in its own module (no native imports) so it can be reused by tests with
// an in-memory SQLite, and so `lib/db/index.ts` stays focused on migrations and
// seeding. Every CREATE uses IF NOT EXISTS; columns added after v1 are covered
// by the idempotent ALTERs in `initializeDatabase`.

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  name TEXT NOT NULL,
  name_es TEXT,
  category_id INTEGER REFERENCES categories(id),
  description TEXT,
  description_es TEXT,
  equipment TEXT,
  target_muscle TEXT,
  muscle_group TEXT,
  body_part TEXT,
  secondary_muscles TEXT,
  instructions_es TEXT,
  image_url TEXT,
  gif_url TEXT,
  original_id TEXT,
  unit TEXT DEFAULT 'kg',
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS name_category_idx ON exercises(name, category_id);

CREATE TABLE IF NOT EXISTS routine_folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#00F5A0',
  icon TEXT DEFAULT '📁',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS routines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category_id INTEGER REFERENCES categories(id),
  folder_id INTEGER REFERENCES routine_folders(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS routine_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  "order" INTEGER NOT NULL,
  target_sets INTEGER DEFAULT 3,
  target_reps INTEGER DEFAULT 10
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  routine_id INTEGER REFERENCES routines(id) ON DELETE SET NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  duration INTEGER,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS sessions_completed_at_idx ON sessions(completed_at);
CREATE INDEX IF NOT EXISTS sessions_routine_id_idx ON sessions(routine_id);

CREATE TABLE IF NOT EXISTS session_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  "order" INTEGER NOT NULL,
  rest_time INTEGER DEFAULT 60,
  notes TEXT,
  note_type TEXT,
  superset_pair_id INTEGER
);

CREATE INDEX IF NOT EXISTS se_session_idx ON session_exercises(session_id);
CREATE INDEX IF NOT EXISTS se_exercise_idx ON session_exercises(exercise_id);

CREATE TABLE IF NOT EXISTS sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_exercise_id INTEGER NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps INTEGER,
  weight REAL,
  completed INTEGER NOT NULL DEFAULT 0,
  method TEXT DEFAULT 'linear',
  drop_order INTEGER DEFAULT 0,
  is_drop_group INTEGER DEFAULT 0,
  rir INTEGER,
  partial_reps INTEGER,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sets_session_exercise_idx ON sets(session_exercise_id);

CREATE TABLE IF NOT EXISTS body_measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  date INTEGER NOT NULL,
  weight REAL,
  body_fat REAL,
  chest REAL,
  waist REAL,
  hips REAL,
  arms REAL,
  thighs REAL,
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS progress_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  date INTEGER NOT NULL,
  uri TEXT NOT NULL,
  body_part TEXT,
  created_at INTEGER NOT NULL
);
`;
