-- ============================================================================
-- Forja — Supabase / PostgreSQL schema  (PLAN, not yet the live source of truth)
-- ============================================================================
-- Today the app is OFFLINE-FIRST: all data lives in local SQLite (lib/db/ddl.ts,
-- lib/db/schema.ts) and Supabase is used for AUTH ONLY. This file is the plan for
-- the future migration; it is kept aligned with the local source of truth.
--
-- HOW TO RUN (Supabase SQL Editor) — in this exact order:
--   1. scripts/supabase-schema.sql            (tables + indexes + RLS)  <- this file
--   2. scripts/create-delete-account-rpc.sql  (delete_user_account() RPC)
--   3. scripts/import-exercises.sql           (seed categories + shared exercises)
--
-- Each file is written to be IDEMPOTENT: running it twice must not error.
-- Re-running file 1 is safe; DROP POLICY IF EXISTS + CREATE POLICY are used for
-- that reason, and ALTER ... ADD COLUMN IF NOT EXISTS upgrades older installs.
--
-- WHAT TO CHECK AFTER RUNNING (see the report for the full checklist):
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
--     -> every public table must show rowsecurity = true.
--   SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public';
--     -> every owned table must have SELECT/INSERT/UPDATE/DELETE rows.
--   SELECT count(*) FROM exercises WHERE user_id IS NULL;
--     -> shared library seeded (0 until import-exercises.sql is run).
-- ============================================================================


-- Apply atomically. PostgreSQL DDL is transactional, so the tables, their indexes and
-- the whole RLS block either all land or none do. Without this, a failure halfway would
-- leave some tables with RLS enabled and no policies yet — which denies every read
-- through the anon and authenticated keys instead of failing honestly.
BEGIN;

-- Enable UUID extension (auth.uid() is a UUID; user_id columns are UUID).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================================
-- TABLES
-- ============================================================================

-- categories — GLOBAL / SHARED reference data (Strength, Core, Cardio). Seeded by
-- the admin (scripts/import-exercises.sql), never written by clients. Real SQLite
-- source: lib/db/ddl.ts. No user_id: it is the same for everyone.
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- exercises — SHARED seeded library (user_id IS NULL) PLUS user-created customs
-- (user_id = auth.uid()). This dual nature is why the read policy is
-- "shared OR mine" and the write policies are "only mine". See RLS below.
-- secondary_muscles is TEXT (not JSONB) to match the app, which stores and reads
-- it as a JSON string (JSON.stringify / JSON.parse). Kept as SQLite parity.
CREATE TABLE IF NOT EXISTS exercises (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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
  original_id TEXT UNIQUE,
  unit TEXT DEFAULT 'kg',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- routine_folders — user-owned grouping for routines.
CREATE TABLE IF NOT EXISTS routine_folders (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#00F5A0',
  icon TEXT DEFAULT '📁',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- routines — user-owned. folder_id -> routine_folders ON DELETE SET NULL so that
-- deleting a folder keeps its routines (it only un-files them). Matches the app.
CREATE TABLE IF NOT EXISTS routines (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category_id INTEGER REFERENCES categories(id),
  folder_id INTEGER REFERENCES routine_folders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- routine_exercises — child of routines; ownership inherited through routine_id.
-- exercise_id -> exercises ON DELETE RESTRICT: an exercise that a routine uses
-- cannot be silently deleted (matches the app's schema).
CREATE TABLE IF NOT EXISTS routine_exercises (
  id SERIAL PRIMARY KEY,
  routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  "order" INTEGER NOT NULL,
  target_sets INTEGER DEFAULT 3,
  target_reps INTEGER DEFAULT 10
);

-- sessions — user-owned workout sessions. routine_id -> routines ON DELETE SET
-- NULL: see the FK decision comment near the FK normalization block below.
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id INTEGER REFERENCES routines(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration INTEGER,
  notes TEXT
);

-- session_exercises — child of sessions; ownership inherited through session_id.
CREATE TABLE IF NOT EXISTS session_exercises (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
  "order" INTEGER NOT NULL,
  rest_time INTEGER DEFAULT 60,
  notes TEXT,
  note_type TEXT,
  superset_pair_id INTEGER
);

-- sets — grandchild (sessions -> session_exercises -> sets); ownership inherited
-- through session_exercise_id. completed / is_drop_group are BOOLEAN because the
-- app models them as booleans (SQLite stores 0/1; Postgres uses TRUE/FALSE).
CREATE TABLE IF NOT EXISTS sets (
  id SERIAL PRIMARY KEY,
  session_exercise_id INTEGER NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps INTEGER,
  weight DOUBLE PRECISION,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  method TEXT DEFAULT 'linear',
  drop_order INTEGER DEFAULT 0,
  is_drop_group BOOLEAN DEFAULT FALSE,
  rir INTEGER,
  partial_reps INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- body_measurements — user-owned. length columns use DOUBLE PRECISION so a
-- measurement keeps SQLite REAL (float8) precision; REAL would be float4.
CREATE TABLE IF NOT EXISTS body_measurements (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  weight DOUBLE PRECISION,          -- kg
  body_fat DOUBLE PRECISION,        -- percentage
  chest DOUBLE PRECISION,           -- cm
  waist DOUBLE PRECISION,           -- cm
  hips DOUBLE PRECISION,            -- cm
  arms DOUBLE PRECISION,            -- cm (per arm)
  thighs DOUBLE PRECISION,          -- cm (per thigh)
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- progress_photos — user-owned. uri is a local file URI today; it will need a
-- Storage bucket before these rows mean anything remote (see report: open
-- product question, not decided here).
CREATE TABLE IF NOT EXISTS progress_photos (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uri TEXT NOT NULL,
  body_part TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- UPGRADE PATH for installs created by the OLD version of this file.
-- CREATE TABLE IF NOT EXISTS is a no-op when a table already exists, so the
-- columns added since then must be back-filled explicitly. ADD COLUMN IF NOT
-- EXISTS makes this safe to re-run.
-- ============================================================================
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS name_es TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS description_es TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS body_part TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'kg';

ALTER TABLE routines ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES routine_folders(id) ON DELETE SET NULL;

ALTER TABLE session_exercises ADD COLUMN IF NOT EXISTS rest_time INTEGER DEFAULT 60;
ALTER TABLE session_exercises ADD COLUMN IF NOT EXISTS note_type TEXT;
ALTER TABLE session_exercises ADD COLUMN IF NOT EXISTS superset_pair_id INTEGER;

ALTER TABLE sets ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'linear';
ALTER TABLE sets ADD COLUMN IF NOT EXISTS drop_order INTEGER DEFAULT 0;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS is_drop_group BOOLEAN DEFAULT FALSE;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS rir INTEGER;
ALTER TABLE sets ADD COLUMN IF NOT EXISTS partial_reps INTEGER;


-- ============================================================================
-- FOREIGN KEY NORMALIZATION
-- The old plan declared these FKs with the default NO ACTION. Re-assert them with
-- the behaviour the app relies on. Drop-then-add keeps this idempotent.
--
-- DECISION — sessions.routine_id is ON DELETE SET NULL, NOT CASCADE:
--   A session is a historical record of what was actually trained. Deleting a
--   routine must NOT erase the workouts done with it, so the session survives and
--   simply loses its routine link (routine_id -> NULL). The app does the same
--   (lib/db/schema.ts: onDelete: 'set null'). CASCADE would destroy history.
-- ============================================================================
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_routine_id_fkey;
ALTER TABLE sessions ADD CONSTRAINT sessions_routine_id_fkey
  FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE SET NULL;

-- exercise_id -> RESTRICT: a library exercise referenced by a routine or a
-- logged session cannot be deleted out from under that history. The app declares
-- exactly this (ON DELETE RESTRICT in lib/db/schema.ts), so the plan mirrors it.
ALTER TABLE routine_exercises DROP CONSTRAINT IF EXISTS routine_exercises_exercise_id_fkey;
ALTER TABLE routine_exercises ADD CONSTRAINT routine_exercises_exercise_id_fkey
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT;

ALTER TABLE session_exercises DROP CONSTRAINT IF EXISTS session_exercises_exercise_id_fkey;
ALTER TABLE session_exercises ADD CONSTRAINT session_exercises_exercise_id_fkey
  FOREIGN KEY (exercise_id) REFERENCES exercises(id) ON DELETE RESTRICT;


-- ============================================================================
-- INDEXES
-- A policy that filters on a column with no index is a performance trap: Postgres
-- must scan the whole table for every read. Every user_id column used by an RLS
-- policy, and every FK a child-table policy joins through, gets an index.
-- ============================================================================

-- exercises
CREATE INDEX IF NOT EXISTS idx_exercises_name_category ON exercises(name, category_id);
CREATE INDEX IF NOT EXISTS idx_exercises_muscle_group ON exercises(muscle_group);
CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment);
CREATE INDEX IF NOT EXISTS idx_exercises_user_id ON exercises(user_id);   -- RLS: shared OR mine

-- routine_folders (user_id used by RLS)
CREATE INDEX IF NOT EXISTS idx_routine_folders_user_id ON routine_folders(user_id);

-- routines (user_id used by RLS; folder_id / category_id are FKs used by queries)
CREATE INDEX IF NOT EXISTS idx_routines_user_id ON routines(user_id);
CREATE INDEX IF NOT EXISTS idx_routines_folder_id ON routines(folder_id);
CREATE INDEX IF NOT EXISTS idx_routines_category_id ON routines(category_id);

-- routine_exercises (routine_id used by the inherited-ownership policy)
CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine_id ON routine_exercises(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_exercise_id ON routine_exercises(exercise_id);

-- sessions (user_id used by RLS; routine_id / completed_at used by the app)
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_routine_id ON sessions(routine_id);
CREATE INDEX IF NOT EXISTS idx_sessions_completed_at ON sessions(completed_at);

-- session_exercises (session_id used by the inherited-ownership policy)
CREATE INDEX IF NOT EXISTS idx_session_exercises_session_id ON session_exercises(session_id);
CREATE INDEX IF NOT EXISTS idx_session_exercises_exercise_id ON session_exercises(exercise_id);

-- sets (session_exercise_id used by the inherited-ownership policy)
CREATE INDEX IF NOT EXISTS idx_sets_session_exercise_id ON sets(session_exercise_id);

-- body_measurements / progress_photos (user_id used by RLS)
CREATE INDEX IF NOT EXISTS idx_body_measurements_user_id ON body_measurements(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_photos_user_id ON progress_photos(user_id);


-- ============================================================================
-- ROW LEVEL SECURITY
-- Every table below has RLS ENABLED. Policies are written per operation
-- (SELECT / INSERT / UPDATE / DELETE) instead of FOR ALL so the intent of each
-- operation is explicit, and every write carries a WITH CHECK so a client cannot
-- move a row out of its own ownership.
--
-- Policies are scoped TO authenticated. The publishable (anon) key is public by
-- design, so nothing is readable before sign-in: anon gets no policy and is
-- therefore denied. If the app later needs to browse the shared library before
-- login, add a separate `TO anon` SELECT policy for categories/exercises only.
--
-- Supabase grants table privileges to anon/authenticated by default; RLS is the
-- gate that narrows them. service_role and the table owner bypass RLS, which is
-- how admin seeding (import-exercises.sql) works.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- categories — GLOBAL / SHARED. Read for everyone signed in; nobody writes from
-- a client. There are deliberately NO INSERT/UPDATE/DELETE policies: with RLS
-- enabled and no write policy, all client writes are denied (admin seeding runs
-- as the owner and bypasses RLS). This is the intended "shared reference data".
-- ---------------------------------------------------------------------------
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_shared" ON categories;
CREATE POLICY "categories_select_shared" ON categories
  FOR SELECT TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- exercises — SHARED library + per-user customs.
--   SELECT: a user sees the shared seed rows (user_id IS NULL) plus their own.
--   INSERT: a client may only create its OWN row (user_id = auth.uid()); it can
--           never insert into the shared library.
--   UPDATE/DELETE: only the user's own rows; the shared library is immutable to
--           clients (no policy can touch user_id IS NULL rows).
-- ---------------------------------------------------------------------------
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exercises_select_shared_or_own" ON exercises;
CREATE POLICY "exercises_select_shared_or_own" ON exercises
  FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS "exercises_insert_own" ON exercises;
CREATE POLICY "exercises_insert_own" ON exercises
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "exercises_update_own" ON exercises;
CREATE POLICY "exercises_update_own" ON exercises
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "exercises_delete_own" ON exercises;
CREATE POLICY "exercises_delete_own" ON exercises
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- routines — user-owned. All four operations require user_id = auth.uid().
-- ---------------------------------------------------------------------------
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "routines_select_own" ON routines;
CREATE POLICY "routines_select_own" ON routines
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "routines_insert_own" ON routines;
CREATE POLICY "routines_insert_own" ON routines
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "routines_update_own" ON routines;
CREATE POLICY "routines_update_own" ON routines
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "routines_delete_own" ON routines;
CREATE POLICY "routines_delete_own" ON routines
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- routine_folders — user-owned. All four operations require user_id = auth.uid().
-- ---------------------------------------------------------------------------
ALTER TABLE routine_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "routine_folders_select_own" ON routine_folders;
CREATE POLICY "routine_folders_select_own" ON routine_folders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "routine_folders_insert_own" ON routine_folders;
CREATE POLICY "routine_folders_insert_own" ON routine_folders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "routine_folders_update_own" ON routine_folders;
CREATE POLICY "routine_folders_update_own" ON routine_folders
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "routine_folders_delete_own" ON routine_folders;
CREATE POLICY "routine_folders_delete_own" ON routine_folders
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- sessions — user-owned. All four operations require user_id = auth.uid().
-- ---------------------------------------------------------------------------
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sessions_select_own" ON sessions;
CREATE POLICY "sessions_select_own" ON sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sessions_insert_own" ON sessions;
CREATE POLICY "sessions_insert_own" ON sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sessions_update_own" ON sessions;
CREATE POLICY "sessions_update_own" ON sessions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "sessions_delete_own" ON sessions;
CREATE POLICY "sessions_delete_own" ON sessions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- body_measurements — user-owned. All four operations require user_id = auth.uid().
-- ---------------------------------------------------------------------------
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "body_measurements_select_own" ON body_measurements;
CREATE POLICY "body_measurements_select_own" ON body_measurements
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "body_measurements_insert_own" ON body_measurements;
CREATE POLICY "body_measurements_insert_own" ON body_measurements
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "body_measurements_update_own" ON body_measurements;
CREATE POLICY "body_measurements_update_own" ON body_measurements
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "body_measurements_delete_own" ON body_measurements;
CREATE POLICY "body_measurements_delete_own" ON body_measurements
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- progress_photos — user-owned. All four operations require user_id = auth.uid().
-- ---------------------------------------------------------------------------
ALTER TABLE progress_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "progress_photos_select_own" ON progress_photos;
CREATE POLICY "progress_photos_select_own" ON progress_photos
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "progress_photos_insert_own" ON progress_photos;
CREATE POLICY "progress_photos_insert_own" ON progress_photos
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "progress_photos_update_own" ON progress_photos;
CREATE POLICY "progress_photos_update_own" ON progress_photos
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "progress_photos_delete_own" ON progress_photos;
CREATE POLICY "progress_photos_delete_own" ON progress_photos
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- routine_exercises — CHILD of routines; ownership INHERITED through routine_id.
-- A row is visible/writable only if its parent routine belongs to the caller.
-- The EXISTS subquery runs under the routines RLS policy too, so the parent check
-- is never bypassed. Indexed on routine_exercises(routine_id) above.
-- ---------------------------------------------------------------------------
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "routine_exercises_select_own" ON routine_exercises;
CREATE POLICY "routine_exercises_select_own" ON routine_exercises
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM routines r
    WHERE r.id = routine_exercises.routine_id AND r.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "routine_exercises_insert_own" ON routine_exercises;
CREATE POLICY "routine_exercises_insert_own" ON routine_exercises
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM routines r
    WHERE r.id = routine_exercises.routine_id AND r.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "routine_exercises_update_own" ON routine_exercises;
CREATE POLICY "routine_exercises_update_own" ON routine_exercises
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM routines r
    WHERE r.id = routine_exercises.routine_id AND r.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM routines r
    WHERE r.id = routine_exercises.routine_id AND r.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "routine_exercises_delete_own" ON routine_exercises;
CREATE POLICY "routine_exercises_delete_own" ON routine_exercises
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM routines r
    WHERE r.id = routine_exercises.routine_id AND r.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- session_exercises — CHILD of sessions; ownership INHERITED through session_id.
-- Indexed on session_exercises(session_id) above.
-- ---------------------------------------------------------------------------
ALTER TABLE session_exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "session_exercises_select_own" ON session_exercises;
CREATE POLICY "session_exercises_select_own" ON session_exercises
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.id = session_exercises.session_id AND s.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "session_exercises_insert_own" ON session_exercises;
CREATE POLICY "session_exercises_insert_own" ON session_exercises
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.id = session_exercises.session_id AND s.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "session_exercises_update_own" ON session_exercises;
CREATE POLICY "session_exercises_update_own" ON session_exercises
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.id = session_exercises.session_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.id = session_exercises.session_id AND s.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "session_exercises_delete_own" ON session_exercises;
CREATE POLICY "session_exercises_delete_own" ON session_exercises
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.id = session_exercises.session_id AND s.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- sets — GRANDCHILD (sessions -> session_exercises -> sets). Ownership follows
-- the chain session_exercises.session_id -> sessions.user_id. Indexed on
-- sets(session_exercise_id) above.
-- ---------------------------------------------------------------------------
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sets_select_own" ON sets;
CREATE POLICY "sets_select_own" ON sets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM session_exercises se
    JOIN sessions s ON s.id = se.session_id
    WHERE se.id = sets.session_exercise_id AND s.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "sets_insert_own" ON sets;
CREATE POLICY "sets_insert_own" ON sets
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM session_exercises se
    JOIN sessions s ON s.id = se.session_id
    WHERE se.id = sets.session_exercise_id AND s.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "sets_update_own" ON sets;
CREATE POLICY "sets_update_own" ON sets
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM session_exercises se
    JOIN sessions s ON s.id = se.session_id
    WHERE se.id = sets.session_exercise_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM session_exercises se
    JOIN sessions s ON s.id = se.session_id
    WHERE se.id = sets.session_exercise_id AND s.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "sets_delete_own" ON sets;
CREATE POLICY "sets_delete_own" ON sets
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM session_exercises se
    JOIN sessions s ON s.id = se.session_id
    WHERE se.id = sets.session_exercise_id AND s.user_id = auth.uid()
  ));

COMMIT;
