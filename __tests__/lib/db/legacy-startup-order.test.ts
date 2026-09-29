// A database created before the identity layer has no `uuid` column, and the shipping
// `initializeDatabase` ran `CREATE_TABLES_SQL` *before* `runSchemaMigrations`: the DDL
// carries the nine `CREATE UNIQUE INDEX ... (uuid)` statements while the ALTER that adds
// `uuid` lives in the migrations. SQLite refuses an index over a column that does not
// exist, so the first statement threw, the whole startup failed, and the app showed the
// database-failure screen — on every existing install, and never on a fresh one.
//
// This is the gap that let it ship: the pieces are each tested (migrations, backfill,
// orphan cleanup), and `schema-freeze.test.ts`'s upgrade case applies the legacy fixture
// and then calls `runSchemaMigrations` **alone** — the reverse of the assembled order.
// This case runs the assembled `initializeDatabase`, which is what the phone runs.
//
// Only the native module boundary is faked, exactly as in `orphan-cleanup.test.ts`.
jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = require('node:sqlite');
  const sqlite = new DatabaseSync(':memory:');
  const isRowReturning = (sql: string) =>
    /^\s*(select|pragma|with)\b/i.test(sql) || /\breturning\b/i.test(sql);

  const client: any = {
    execSync: (sql: string) => sqlite.exec(sql),
    getFirstSync: (sql: string, ...params: unknown[]) => sqlite.prepare(sql).get(...params) ?? null,
    prepareSync(sql: string) {
      const statement = sqlite.prepare(sql);
      return {
        executeSync(params: unknown[] = []) {
          if (isRowReturning(sql)) {
            statement.setReturnArrays(true);
            const rows = statement.all(...params);
            return {
              changes: 0,
              lastInsertRowId: 0,
              getAllSync: () => rows,
              getFirstSync: () => rows[0],
            };
          }
          const info = statement.run(...params);
          return {
            changes: info.changes,
            lastInsertRowId: info.lastInsertRowid,
            getAllSync: () => [],
            getFirstSync: () => undefined,
          };
        },
        executeForRawResultSync(params: unknown[] = []) {
          statement.setReturnArrays(true);
          const rows = statement.all(...params);
          return { getAllSync: () => rows, getFirstSync: () => rows[0] };
        },
      };
    },
  };

  return { __esModule: true, openDatabaseSync: () => client, __sqlite: sqlite };
});

import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';
import { initializeDatabase } from '../../../lib/db/index';

const sqlite: any = require('expo-sqlite').__sqlite;

/**
 * A database created before the identity layer: the current DDL minus the three columns and
 * the nine indexes the migrations are responsible for. Same proxy the schema-freeze fixture
 * uses ("the manifest minus every migration-added column").
 */
const LEGACY_DDL = CREATE_TABLES_SQL.replace(
  /^CREATE UNIQUE INDEX IF NOT EXISTS \w+_uuid_idx ON \w+ \(uuid\);\s*$/gm,
  ''
)
  .replace(/^  (uuid|updated_at|deleted_at) (TEXT|INTEGER),?\n/gm, '')
  .replace(/,\n\);/g, '\n);');

describe('initializeDatabase on a database created before the identity layer', () => {
  it('initializes it instead of failing on an index over a missing column', async () => {
    sqlite.exec(LEGACY_DDL);
    // One seeded-looking exercise, so the startup takes its early-return branch instead of
    // seeding the whole library, and so a surviving row can be checked afterwards.
    sqlite.exec(`INSERT INTO exercises (id, name, created_at) VALUES (1, 'Bench Press', 1000)`);

    // PRECONDITION: the column is genuinely absent, so the failure under test is real.
    const before = (sqlite.prepare('PRAGMA table_info(exercises)').all() as { name: string }[]).map(
      (column) => column.name
    );
    expect(before).not.toContain('uuid');

    await expect(initializeDatabase()).resolves.toBeUndefined();

    // The migration ran, and it did not cost the user their data.
    const after = (sqlite.prepare('PRAGMA table_info(exercises)').all() as { name: string }[]).map(
      (column) => column.name
    );
    expect(after).toEqual(expect.arrayContaining(['uuid', 'updated_at', 'deleted_at']));
    expect(sqlite.prepare('SELECT name FROM exercises WHERE id = 1').get()).toEqual({
      name: 'Bench Press',
    });

    const indexes = (sqlite.prepare('PRAGMA index_list(exercises)').all() as { name: string }[]).map(
      (index) => index.name
    );
    expect(indexes).toContain('exercises_uuid_idx');
  });
});
