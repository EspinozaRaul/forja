-- Fitness Tracker - Supabase PostgreSQL Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension (for future auth integration)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exercises (with full dataset fields)
CREATE TABLE IF NOT EXISTS exercises (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  description TEXT,
  equipment TEXT,
  target_muscle TEXT,
  muscle_group TEXT,
  secondary_muscles JSONB DEFAULT '[]'::jsonb,
  instructions_es TEXT,
  image_url TEXT,
  gif_url TEXT,
  original_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercises_name_category ON exercises(name, category_id);
CREATE INDEX IF NOT EXISTS idx_exercises_original_id ON exercises(original_id);
CREATE INDEX IF NOT EXISTS idx_exercises_muscle_group ON exercises(muscle_group);
CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment);

-- Routines
CREATE TABLE IF NOT EXISTS routines (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category_id INTEGER REFERENCES categories(id),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Routine Exercises
CREATE TABLE IF NOT EXISTS routine_exercises (
  id SERIAL PRIMARY KEY,
  routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  "order" INTEGER NOT NULL,
  target_sets INTEGER DEFAULT 3,
  target_reps INTEGER DEFAULT 10
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  routine_id INTEGER REFERENCES routines(id),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration INTEGER,
  notes TEXT
);

-- Session Exercises
CREATE TABLE IF NOT EXISTS session_exercises (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  "order" INTEGER NOT NULL,
  notes TEXT
);

-- Sets
CREATE TABLE IF NOT EXISTS sets (
  id SERIAL PRIMARY KEY,
  session_exercise_id INTEGER NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  reps INTEGER,
  weight REAL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Policies: users can only see/modify their own data
CREATE POLICY "Users can view own routines" ON routines
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own routines" ON routines
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own routines" ON routines
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own routines" ON routines
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own sessions" ON sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Exercises and categories are public (read-only for all users)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are viewable by everyone" ON categories
  FOR SELECT USING (true);

CREATE POLICY "Exercises are viewable by everyone" ON exercises
  FOR SELECT USING (true);

-- Users can manage their own routine_exercises
CREATE POLICY "Users can manage own routine_exercises" ON routine_exercises
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM routines WHERE routines.id = routine_exercises.routine_id AND routines.user_id = auth.uid()
    )
  );

-- Users can manage their own session_exercises
CREATE POLICY "Users can manage own session_exercises" ON session_exercises
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sessions WHERE sessions.id = session_exercises.session_id AND sessions.user_id = auth.uid()
    )
  );

-- Users can manage their own sets
CREATE POLICY "Users can manage own sets" ON sets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM session_exercises 
      JOIN sessions ON sessions.id = session_exercises.session_id 
      WHERE session_exercises.id = sets.session_exercise_id AND sessions.user_id = auth.uid()
    )
  );
