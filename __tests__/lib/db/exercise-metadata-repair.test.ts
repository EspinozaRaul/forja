/* eslint-disable @typescript-eslint/no-explicit-any */
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';

// `lib/db/index` opens the real device database at import time. The repair we
// exercise here is database-agnostic (it receives its `db`), so the native module
// only needs to stop the import from throwing. Every assertion below runs the SQL
// that ships, against an in-memory node:sqlite database.
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: () => ({ execSync: jest.fn() }),
}));

import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { repairExerciseMetadata, type ExerciseRepairSource } from '../../../lib/db/index';

const OLD_GIF = 'assets/exercises/gifs/0001.gif';
const DATASET_GIF = '0001-2gPfomN.gif';
const FIXED_GIF_URL =
  'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/videos/0001-2gPfomN.gif';

const DATASET: ExerciseRepairSource[] = [
  { id: '0001', c: 'chest', gf: DATASET_GIF },
  { id: '0002', c: 'back' }, // no gif in the dataset row
];

function makeDb() {
  const sqlite = new DatabaseSync(':memory:');
  const proxy = drizzle(((sql: string, params: any[], method: string) => {
    const statement = sqlite.prepare(sql);
    if (method === 'run') {
      statement.run(...params);
      return Promise.resolve({ rows: [] });
    }
    statement.setReturnArrays(true);
    const rows = statement.all(...params);
    return Promise.resolve(method === 'get' ? { rows: rows[0] } : { rows });
  }) as any);
  return { sqlite, db: proxy as any };
}

function count(sqlite: any, sql: string): number {
  return sqlite.prepare(sql).get().c;
}

describe('repairExerciseMetadata (bug C1: never delete exercises as a migration)', () => {
  let sqlite: any;
  let db: any;

  beforeEach(() => {
    ({ sqlite, db } = makeDb());
    sqlite.exec(CREATE_TABLES_SQL);
    sqlite.exec(
      "INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#fff', 'x', 0);"
    );
    // Seeded-style row: old broken gif URL, missing body_part, dataset original id.
    sqlite.exec(
      `INSERT INTO exercises (id, name, category_id, body_part, gif_url, original_id, created_at)
       VALUES (10, 'Bench Press', 1, NULL, '${OLD_GIF}', '0001', 0);`
    );
    // Partial row: missing body_part but a valid (already new-style) gif URL.
    sqlite.exec(
      `INSERT INTO exercises (id, name, category_id, body_part, gif_url, original_id, created_at)
       VALUES (11, 'Bent Over Row', 1, '', NULL, '0002', 0);`
    );
    // User custom: original_id NULL, owned by a user, no body_part.
    sqlite.exec(
      `INSERT INTO exercises (id, name, body_part, gif_url, original_id, user_id, created_at)
       VALUES (20, 'My Custom Move', NULL, NULL, NULL, 'user-a', 0);`
    );
    sqlite.exec(
      "INSERT INTO routines (id, name, user_id, created_at) VALUES (1, 'Push Day', 'user-a', 0);"
    );
    sqlite.exec(
      'INSERT INTO routine_exercises (id, routine_id, exercise_id, "order") VALUES (1, 1, 10, 0);'
    );
  });

  it('repairs metadata in place without deleting rows or changing ids', async () => {
    const beforeIds = sqlite
      .prepare('SELECT group_concat(id) AS ids FROM (SELECT id FROM exercises ORDER BY id)')
      .get().ids;

    await repairExerciseMetadata(db, DATASET);

    // Nothing was deleted and every primary key is stable.
    expect(count(sqlite, 'SELECT COUNT(*) AS c FROM exercises')).toBe(3);
    expect(
      sqlite
        .prepare('SELECT group_concat(id) AS ids FROM (SELECT id FROM exercises ORDER BY id)')
        .get().ids
    ).toBe(beforeIds);

    // The broken gif URL was replaced from the dataset row with the same original id…
    const repaired = sqlite.prepare('SELECT * FROM exercises WHERE id = 10').get();
    expect(repaired.gif_url).toBe(FIXED_GIF_URL);
    // …and the missing body_part was filled from the dataset `c` field.
    expect(repaired.body_part).toBe('chest');
    expect(repaired.original_id).toBe('0001');

    // The second row had no dataset gif, so only its body_part changed.
    const partial = sqlite.prepare('SELECT * FROM exercises WHERE id = 11').get();
    expect(partial.body_part).toBe('back');
    expect(partial.gif_url).toBeNull();

    // The user's custom exercise is untouched.
    const custom = sqlite.prepare('SELECT * FROM exercises WHERE id = 20').get();
    expect(custom.name).toBe('My Custom Move');
    expect(custom.body_part).toBeNull();
    expect(custom.original_id).toBeNull();
    expect(custom.user_id).toBe('user-a');

    // References from routines still resolve to the same exercise row.
    expect(
      sqlite.prepare('SELECT exercise_id FROM routine_exercises WHERE id = 1').get().exercise_id
    ).toBe(10);
  });

  it('is idempotent: a second run changes nothing', async () => {
    await repairExerciseMetadata(db, DATASET);
    const firstPass = sqlite.prepare('SELECT id, gif_url, body_part FROM exercises ORDER BY id').all();

    await repairExerciseMetadata(db, DATASET);

    expect(sqlite.prepare('SELECT id, gif_url, body_part FROM exercises ORDER BY id').all()).toEqual(
      firstPass
    );
    expect(count(sqlite, 'SELECT COUNT(*) AS c FROM exercises')).toBe(3);
  });

  it('leaves rows whose original_id is absent from the dataset alone', async () => {
    sqlite.exec(
      `INSERT INTO exercises (id, name, body_part, gif_url, original_id, created_at)
       VALUES (12, 'Unknown Legacy', NULL, '${OLD_GIF}', '9999', 0);`
    );

    await repairExerciseMetadata(db, DATASET);

    const unknown = sqlite.prepare('SELECT * FROM exercises WHERE id = 12').get();
    expect(unknown.gif_url).toBe(OLD_GIF);
    expect(unknown.body_part).toBeNull();
    expect(count(sqlite, 'SELECT COUNT(*) AS c FROM exercises')).toBe(4);
  });
});
