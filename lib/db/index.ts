import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import { categories, exercises } from './schema';
import { and, eq, isNotNull, isNull, like, or, sql } from 'drizzle-orm';
import exercisesData from './exercises-data.json';
import { EXERCISE_NAMES_ES } from './exercise-names-es';
import { now } from '../utils/date';
import { CREATE_TABLES_SQL } from './ddl';

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

// Table DDL lives in ./ddl.ts, shared with the in-memory test database.

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

/** Minimal view of a dataset row needed to repair seeded exercise metadata. */
export interface ExerciseRepairSource {
  id: string;   // dataset id, mirrored into exercises.original_id
  c: string;    // dataset category == exercises.body_part
  gf?: string;  // gif filename without the repository URL
}

const OLD_GIF_PREFIX = 'assets/exercises/gifs/';

/** Builds the raw GitHub URL the dataset gif files are served from. */
function datasetGifUrl(gifFile: string): string {
  return `https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/${gifFile}`;
}

/**
 * Repairs seeded exercise metadata in place.
 *
 * Exercise ids are referenced by `routine_exercises.exercise_id` and
 * `session_exercises.exercise_id`, and user-created exercises live in the same
 * table. A migration must therefore never delete and re-seed: doing so orphans
 * every routine, every historical session, and destroys user customs. Only rows
 * that carry a dataset `original_id` are matched; rows with `original_id IS NULL`
 * (user customs) are never touched.
 */
export async function repairExerciseMetadata(
  database: typeof db,
  dataset: ExerciseRepairSource[]
): Promise<void> {
  const gifByOriginalId = new Map<string, string>();
  const bodyPartByOriginalId = new Map<string, string>();

  for (const source of dataset) {
    if (source.gf) gifByOriginalId.set(source.id, datasetGifUrl(source.gf));
    if (source.c) bodyPartByOriginalId.set(source.id, source.c);
  }

  // Old seeded rows stored a local asset path instead of the dataset URL.
  const brokenGifRows = await database
    .select({ originalId: exercises.originalId })
    .from(exercises)
    .where(and(like(exercises.gifUrl, `${OLD_GIF_PREFIX}%`), isNotNull(exercises.originalId)));

  for (const { originalId } of brokenGifRows) {
    if (!originalId) continue;
    const gifUrl = gifByOriginalId.get(originalId);
    if (!gifUrl) continue;
    await database
      .update(exercises)
      .set({ gifUrl })
      .where(
        and(eq(exercises.originalId, originalId), like(exercises.gifUrl, `${OLD_GIF_PREFIX}%`))
      );
  }

  // Rows seeded before `body_part` existed have an empty/NULL value.
  const missingBodyPartRows = await database
    .select({ originalId: exercises.originalId })
    .from(exercises)
    .where(
      and(
        isNotNull(exercises.originalId),
        or(isNull(exercises.bodyPart), eq(exercises.bodyPart, ''))
      )
    );

  for (const { originalId } of missingBodyPartRows) {
    if (!originalId) continue;
    const bodyPart = bodyPartByOriginalId.get(originalId);
    if (!bodyPart) continue;
    await database
      .update(exercises)
      .set({ bodyPart })
      .where(
        and(
          eq(exercises.originalId, originalId),
          or(isNull(exercises.bodyPart), eq(exercises.bodyPart, ''))
        )
      );
  }
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

  // Migration: add user_id columns for Supabase RLS (nullable for local SQLite)
  try {
    expoDb.execSync("ALTER TABLE sessions ADD COLUMN user_id TEXT");
  } catch {
    // Column already exists, ignore
  }
  try {
    expoDb.execSync("ALTER TABLE routines ADD COLUMN user_id TEXT");
  } catch {
    // Column already exists, ignore
  }
  try {
    expoDb.execSync("ALTER TABLE routine_folders ADD COLUMN user_id TEXT");
  } catch {
    // Column already exists, ignore
  }
  try {
    expoDb.execSync("ALTER TABLE body_measurements ADD COLUMN user_id TEXT");
  } catch {
    // Column already exists, ignore
  }
  try {
    expoDb.execSync("ALTER TABLE progress_photos ADD COLUMN user_id TEXT");
  } catch {
    // Column already exists, ignore
  }
  // exercises is the shared library plus user-created customs: seeded rows keep
  // user_id NULL (visible to everyone), customs are stamped with their owner.
  try {
    expoDb.execSync("ALTER TABLE exercises ADD COLUMN user_id TEXT");
  } catch {
    // Column already exists, ignore
  }

  // Check if exercises already imported
  const exerciseCount = await db.select({ count: sql<number>`count(*)` }).from(exercises);
  if (exerciseCount[0].count > 0) {
    // Databases created before `body_part` was added to the DDL need the column
    // before the repair query can reference it.
    try {
      expoDb.execSync('ALTER TABLE exercises ADD COLUMN body_part TEXT');
    } catch {
      // Column already exists, ignore
    }

    // Repair seeded metadata in place. Deleting and re-seeding here would mint new
    // ids and orphan `routine_exercises` / `session_exercises` references.
    await repairExerciseMetadata(db, exercisesData as LeanExercise[]);
    if (__DEV__) console.log(`✅ Database already has ${exerciseCount[0].count} exercises`);
    return;
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
      const gifUrl = ex.gf ? datasetGifUrl(ex.gf) : null;

      await db.insert(exercises).values({
        name: ex.n,
        nameEs: EXERCISE_NAMES_ES[ex.n.toLowerCase().trim()] ?? ex.n,
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
    } catch {
      errors++;
    }
  }

  if (__DEV__) {
    if (__DEV__) console.log(`\n✨ Import complete!`);
    if (__DEV__) console.log(`   ✅ Imported: ${imported} exercises`);
    if (__DEV__) console.log(`   ❌ Errors: ${errors}`);
  }
}
