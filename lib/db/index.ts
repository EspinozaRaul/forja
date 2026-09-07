import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import { categories, exercises } from './schema';
import { sql } from 'drizzle-orm';
import exercisesData from './exercises-data.json';
import { getExerciseNameEs } from '../i18n/exercise-translations';

const DATABASE_NAME = 'fitness-tracker.db';

const expoDb = openDatabaseSync(DATABASE_NAME);

export const db = drizzle(expoDb);

// Categories for the app
const APP_CATEGORIES = [
  { name: 'Strength', color: '#EF4444', icon: '💪' },
  { name: 'Core', color: '#EC4899', icon: '🎯' },
  { name: 'Cardio', color: '#3B82F6', icon: '🏃' },
];

// Map dataset categories → app categories
const CATEGORY_MAP: Record<string, string> = {
  'chest': 'Strength',
  'back': 'Strength',
  'upper arms': 'Strength',
  'upper legs': 'Strength',
  'shoulders': 'Strength',
  'lower arms': 'Strength',
  'lower legs': 'Strength',
  'neck': 'Strength',
  'waist': 'Core',
  'cardio': 'Cardio',
};

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  icon TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#00F5A0',
  icon TEXT DEFAULT '📁',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS routines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  category_id INTEGER REFERENCES categories(id),
  folder_id INTEGER REFERENCES routine_folders(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS routine_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  "order" INTEGER NOT NULL,
  target_sets INTEGER DEFAULT 3,
  target_reps INTEGER DEFAULT 10
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id INTEGER REFERENCES routines(id),
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  duration INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS session_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  "order" INTEGER NOT NULL,
  notes TEXT,
  superset_pair_id INTEGER
);

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
`;

interface LeanExercise {
  id: string;
  n: string;   // name
  c: string;   // category (body part: chest, back, shoulders, etc.)
  e: string;   // equipment
  t: string;   // target muscle
  m: string;   // muscle group
  s: string[]; // secondary muscles
  es: string;  // spanish instructions
  en: string;  // english instructions
  gf?: string; // gif filename (e.g. "0001-2gPfomN.gif")
}

export async function initializeDatabase() {
  // Create tables if they don't exist
  expoDb.execSync(CREATE_TABLES_SQL);

  // Migration: add folder_id to routines if missing
  try {
    expoDb.execSync('ALTER TABLE routines ADD COLUMN folder_id INTEGER REFERENCES routine_folders(id) ON DELETE SET NULL');
  } catch {
    // Column already exists, ignore
  }

  // Migration: add rest_time to session_exercises if missing
  try {
    expoDb.execSync('ALTER TABLE session_exercises ADD COLUMN rest_time INTEGER DEFAULT 60');
  } catch {
    // Column already exists, ignore
  }

  // Migration: add superset pair id to session_exercises
  try {
    expoDb.execSync('ALTER TABLE session_exercises ADD COLUMN superset_pair_id INTEGER');
  } catch {
    // Column already exists, ignore
  }

  // Migration: add unit to exercises if missing
  try {
    expoDb.execSync("ALTER TABLE exercises ADD COLUMN unit TEXT DEFAULT 'kg'");
  } catch {
    // Column already exists, ignore
  }

  // Migration: add drop set columns to sets table
  try {
    expoDb.execSync("ALTER TABLE sets ADD COLUMN method TEXT DEFAULT 'linear'");
  } catch {
    // Column already exists, ignore
  }
  try {
    expoDb.execSync("ALTER TABLE sets ADD COLUMN drop_order INTEGER DEFAULT 0");
  } catch {
    // Column already exists, ignore
  }
  try {
    expoDb.execSync("ALTER TABLE sets ADD COLUMN is_drop_group INTEGER DEFAULT 0");
  } catch {
    // Column already exists, ignore
  }

  // Migration: add RIR (Reps In Reserve) to sets table
  try {
    expoDb.execSync("ALTER TABLE sets ADD COLUMN rir INTEGER");
  } catch {
    // Column already exists, ignore
  }

  // Migration: add partial_reps for 'partial' intensity method
  try {
    expoDb.execSync("ALTER TABLE sets ADD COLUMN partial_reps INTEGER");
  } catch {
    // Column already exists, ignore
  }

  // Migration: add note_type for exercise notes categorization
  try {
    expoDb.execSync("ALTER TABLE session_exercises ADD COLUMN note_type TEXT");
  } catch {
    // Column already exists, ignore
  }

  // Migration: add name_es and description_es for Spanish translations
  try {
    expoDb.execSync("ALTER TABLE exercises ADD COLUMN name_es TEXT");
  } catch {
    // Column already exists, ignore
  }
  try {
    expoDb.execSync("ALTER TABLE exercises ADD COLUMN description_es TEXT");
  } catch {
    // Column already exists, ignore
  }

  // Check if exercises already imported
  const exerciseCount = await db.select({ count: sql<number>`count(*)` }).from(exercises);
  if (exerciseCount[0].count > 0) {
    // Migration: check if body_part column exists and has data
    const sampleBodyPart = await db.select({ bodyPart: exercises.bodyPart }).from(exercises).limit(1);
    const sampleGif = await db.select({ gifUrl: exercises.gifUrl }).from(exercises).limit(1);

    const needsMigration =
      !sampleBodyPart[0]?.bodyPart || // body_part column is empty/missing
      sampleGif[0]?.gifUrl?.startsWith('assets/exercises/gifs/'); // old broken gif URLs

    if (needsMigration) {
      if (__DEV__) console.log('🔄 Migrating exercises (body_part + gif URLs)...');
      // Try to add body_part column if it doesn't exist
      try {
        expoDb.execSync('ALTER TABLE exercises ADD COLUMN body_part TEXT');
      } catch {
        // Column already exists, ignore
      }
      await db.delete(exercises);
      // Fall through to re-seed below
    } else {
      if (__DEV__) console.log(`✅ Database already has ${exerciseCount[0].count} exercises`);
      return;
    }
  }

  // Seed categories (idempotent: skip if already exist)
  const now = new Date();
  const categoryMap: Record<string, number> = {};

  const existingCategories = await db.select().from(categories);
  if (existingCategories.length > 0) {
    for (const cat of existingCategories) {
      categoryMap[cat.name] = cat.id;
    }
    if (__DEV__) console.log(`📁 Using ${existingCategories.length} existing categories`);
  } else {
    for (const cat of APP_CATEGORIES) {
      const result = await db.insert(categories).values({
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        createdAt: now,
      }).returning();
      categoryMap[cat.name] = result[0].id;
    }
    if (__DEV__) console.log(`📁 Created ${APP_CATEGORIES.length} categories`);
  }

  // Import all exercises from lean dataset
  const dataset = exercisesData as LeanExercise[];
  let imported = 0;
  let errors = 0;

  for (const ex of dataset) {
    try {
      const appName = CATEGORY_MAP[ex.c] || 'Strength';
      const categoryId = categoryMap[appName];

      // Build correct GitHub raw URL for GIF (files have hash suffix)
      const gifUrl = ex.gf
        ? `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/${ex.gf}`
        : null;

      await db.insert(exercises).values({
        name: ex.n,
        nameEs: getExerciseNameEs(ex.n),
        categoryId,
        description: ex.en,
        descriptionEs: ex.es,
        equipment: ex.e,
        targetMuscle: ex.t,
        muscleGroup: ex.m,
        bodyPart: ex.c,
        secondaryMuscles: JSON.stringify(ex.s),
        instructionsEs: ex.es,
        imageUrl: `assets/exercises/images/${ex.id}.jpg`,
        gifUrl,
        originalId: ex.id,
        createdAt: now,
      });

      imported++;
      if (imported % 200 === 0) {
        if (__DEV__) console.log(`📥 Imported ${imported} exercises...`);
      }
    } catch (error) {
      errors++;
    }
  }

  if (__DEV__) {
    console.log(`\n✨ Import complete!`);
    console.log(`   ✅ Imported: ${imported} exercises`);
    console.log(`   ❌ Errors: ${errors}`);
  }
}
