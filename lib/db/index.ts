import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import { categories, exercises } from './schema';
import { and, eq, isNotNull, isNull, like, or, sql } from 'drizzle-orm';
import exercisesData from './exercises-data.json';
import { EXERCISE_NAMES_ES } from './exercise-names-es';
import { now } from '../utils/date';
import { CREATE_TABLES_SQL } from './ddl';
import { runSchemaMigrations } from './schema-migrations';
import { runIdentityBackfill } from './identity';
import { ORPHAN_CLEANUP_VERSION } from './migration-versions';

const DATABASE_NAME = 'fitness-tracker.db';

// `PRAGMA user_version` tracks one-time data migrations on a database. Version 1
// is the orphan cleanup in `initializeDatabase` below; a later one-time
// migration claims version 2, then 3, and so on, each compared against its own
// constant before it is allowed to run. The watermarks live in
// `./migration-versions` so this file and `./identity` cannot drift.

const expoDb = openDatabaseSync(DATABASE_NAME);

// SQLite defaults `foreign_keys` OFF, and expo-sqlite 57.0.2 does not enable it
// on either platform, which makes every declared `ON DELETE CASCADE` / `SET NULL`
// action inert: deleting a parent silently leaves its children behind (and a
// `folder_id`/`routine_id` pointing at a row that no longer exists).
//
// It must be issued here, at module scope, and not inside `initializeDatabase`:
// the connection exists from import time, while `initializeDatabase` runs later,
// gated by `useDatabase`. Some writers therefore run before it ever did, and this
// statement is what makes the schema's own declarations true for all of them.
// It is a no-op on `lib/db/index.web.ts`, which has no foreign-key concept.
expoDb.execSync('PRAGMA foreign_keys = ON');

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
 *
 * The UPDATEs below deliberately do NOT bump `updated_at`. They repair shared
 * library rows on every launch (a broken gif URL, a missing `body_part`), which
 * is not a user mutation: stamping `updated_at` here would mark hundreds of
 * shared rows modified on every start and pollute the future sync's change set.
 * A genuine user edit goes through `updateExercise`, which does bump it.
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
  // The column migrations run FIRST, and that order is load-bearing. `CREATE_TABLES_SQL`
  // also creates the nine `uuid` unique indexes, while the `uuid` column itself is added
  // by the migrations below. On a database created before the identity layer the tables
  // already exist — so `CREATE TABLE IF NOT EXISTS` is a no-op — and the column does not:
  // SQLite refuses an index over a missing column, the whole startup threw
  // "no such column: uuid", and the app never left the failure screen. A fresh database
  // hid it, because there the table is created with the column already in it.
  //
  // Running the migrations first is safe on every path: on a fresh database each ALTER
  // throws "no such table" and is swallowed, and the DDL below then creates the full shape.
  //
  // Add the columns a database created before each one existed is missing.
  // Each statement is idempotent (a present column throws and is ignored).
  runSchemaMigrations(expoDb);

  // Create tables if they don't exist
  expoDb.execSync(CREATE_TABLES_SQL);

  // One-time cleanup of the unambiguous orphan rows left behind while
  // `PRAGMA foreign_keys` was never enabled (see U2). Every read joins through a
  // live parent, so these rows render nowhere and they poison `deleteExercise`,
  // which counts references without joining the live parent. It must run before
  // the "exercises already imported" early return below: that is the branch every
  // installed database containing orphans takes, and `routines.folder_id` exists
  // by this point because the ALTER above it already ran.
  //
  // Unlike `PRAGMA foreign_keys = ON` at module scope, which is per-connection
  // and so must run on every launch, this block is a one-time data migration: it
  // runs once per database, gated by the version it records on success, and a
  // launch only pays for it until it has succeeded. A failure here is
  // deliberately non-fatal: these rows are invisible to every read, so the app is
  // usable without the cleanup, and because the version is not stamped the next
  // launch retries it instead of skipping it forever.
  const orphanCleanupVersion =
    expoDb.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;

  if (orphanCleanupVersion < ORPHAN_CLEANUP_VERSION) {
    try {
      expoDb.execSync(`
    DELETE FROM sets              WHERE session_exercise_id NOT IN (SELECT id FROM session_exercises);
    DELETE FROM routine_exercises WHERE routine_id          NOT IN (SELECT id FROM routines);
    UPDATE routines SET folder_id  = NULL WHERE folder_id IS NOT NULL AND folder_id NOT IN (SELECT id FROM routine_folders);
    UPDATE sessions SET routine_id = NULL WHERE routine_id IS NOT NULL AND routine_id NOT IN (SELECT id FROM routines);
  `);
      // Stamped only after the cleanup above succeeded, so a failed run is
      // retried on the next launch rather than skipped forever.
      expoDb.execSync(`PRAGMA user_version = ${ORPHAN_CLEANUP_VERSION}`);
    } catch (error) {
      if (__DEV__) console.error('⚠️ Orphan cleanup failed, retrying on next launch', error);
    }
  }

  // One-time identity backfill: gives every pre-existing row a `uuid` and an
  // `updated_at` (and `created_at` on the two child tables). It must run before
  // the "exercises already imported" early return below, which is the branch
  // every installed database takes, and after the orphan cleanup above so it
  // only claims its watermark on a database whose cleanup already ran. Like that
  // cleanup, a failure is deliberately non-fatal: nothing reads the identity
  // columns yet, and because the version is not stamped the next launch retries
  // it instead of skipping it forever.
  try {
    runIdentityBackfill(expoDb);
  } catch (error) {
    if (__DEV__) console.error('⚠️ Identity backfill failed, retrying on next launch', error);
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
        // The seeded library is shared (`user_id IS NULL`), so it gets no `uuid`
        // and stays keyed by `original_id`; it only needs an identity timestamp.
        updatedAt: now,
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
