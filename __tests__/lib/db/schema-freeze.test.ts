/* eslint-disable @typescript-eslint/no-explicit-any */
import { DatabaseSync } from 'node:sqlite';
import { CREATE_TABLES_SQL } from '../../../lib/db/ddl';
import {
  MIGRATION_ADDED_COLUMNS,
  SCHEMA_MANIFEST,
  SCHEMA_VERSION,
  type SchemaColumn,
  type SchemaIndex,
  type SchemaTable,
} from '../../../lib/db/schema-manifest';
import { runSchemaMigrations } from '../../../lib/db/schema-migrations';

// The schema-freeze contract.
//
// This file reads the real shape back out of SQLite and compares it to
// `SCHEMA_MANIFEST`. `runSchemaMigrations` only needs `execSync`, so the harness
// is a real `node:sqlite` in-memory database behind a minimal client — no
// `expo-sqlite` mock and no import of `lib/db/index` (which opens the device
// database at import time).
//
// Two paths are pinned:
//   * a fresh install, whose `CREATE_TABLES_SQL` must match the manifest exactly
//     (columns in declaration order), and
//   * a legacy install built as the manifest minus `MIGRATION_ADDED_COLUMNS`,
//     which `runSchemaMigrations` must bring to the same frozen shape.
//
// The upgrade path is the audit's gap: every other harness builds its schema
// from `CREATE_TABLES_SQL`, where the ALTER-added columns already exist, so the
// path that actually runs on an installed device is exercised nowhere else.

interface MinimalClient {
  execSync(sql: string): void;
}

function makeClient(): { sqlite: DatabaseSync; client: MinimalClient; statements: string[] } {
  const sqlite = new DatabaseSync(':memory:');
  const statements: string[] = [];
  const client: MinimalClient = {
    execSync: (sql: string) => {
      statements.push(sql);
      sqlite.exec(sql);
    },
  };
  return { sqlite, client, statements };
}

function readColumns(sqlite: DatabaseSync, table: string): SchemaColumn[] {
  return (sqlite.prepare(`PRAGMA table_info(${table})`).all() as any[]).map((row) => ({
    name: row.name,
    type: row.type,
    notNull: row.notnull,
    pk: row.pk,
    dfltValue: row.dflt_value,
  }));
}

function compareIndexes(a: SchemaIndex, b: SchemaIndex): number {
  const aKey = `${a.name ?? ''}\u0000${a.columns.join(',')}`;
  const bKey = `${b.name ?? ''}\u0000${b.columns.join(',')}`;
  return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
}

function readTable(sqlite: DatabaseSync, table: SchemaTable): SchemaTable {
  const indexes = (sqlite.prepare(`PRAGMA index_list(${table.name})`).all() as any[])
    .map((row) => {
      const columns = (sqlite.prepare(`PRAGMA index_info('${row.name}')`).all() as any[])
        .sort((a, b) => a.seqno - b.seqno)
        .map((column) => column.name as string);
      return {
        // SQLite names implicit UNIQUE/PRIMARY KEY indexes `sqlite_autoindex_*`.
        // Those are matched on (unique, columns) with a `null` name, never on the
        // internal name; only explicit `CREATE INDEX` names are pinned.
        name: String(row.name).startsWith('sqlite_autoindex_') ? null : (row.name as string),
        unique: row.unique,
        columns,
      } as SchemaIndex;
    })
    .sort(compareIndexes);
  return { name: table.name, columns: readColumns(sqlite, table.name), indexes };
}

function readShape(sqlite: DatabaseSync): SchemaTable[] {
  return SCHEMA_MANIFEST.map((table) => readTable(sqlite, table));
}

function normalizeShape(tables: SchemaTable[]): SchemaTable[] {
  // `ALTER TABLE ... ADD COLUMN` always appends, so an upgraded database can
  // never keep the fresh-install declaration order. Types, nullability, primary
  // keys, defaults and indexes are still compared strictly, just not position.
  return tables.map((table) => ({
    name: table.name,
    columns: [...table.columns].sort((a, b) => a.name.localeCompare(b.name)),
    indexes: [...table.indexes].sort(compareIndexes),
  }));
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function columnDefinition(column: SchemaColumn): string {
  if (column.pk === 1) {
    // The manifest's only primary keys are `id INTEGER PRIMARY KEY AUTOINCREMENT`.
    return `${quoteIdent(column.name)} ${column.type} PRIMARY KEY AUTOINCREMENT`;
  }
  const parts = [quoteIdent(column.name), column.type];
  if (column.notNull === 1) parts.push('NOT NULL');
  if (column.dfltValue !== null) parts.push('DEFAULT', column.dfltValue);
  return parts.join(' ');
}

function buildCreateTable(table: SchemaTable, columns: SchemaColumn[]): string {
  const clauses = columns.map(columnDefinition);
  // Implicit unique indexes (`name === null`) are recreated as table-level
  // UNIQUE constraints so SQLite mints its own autoindex for them.
  for (const index of table.indexes) {
    if (index.name === null) {
      clauses.push(`UNIQUE (${index.columns.map(quoteIdent).join(', ')})`);
    }
  }
  return `CREATE TABLE ${quoteIdent(table.name)} (\n  ${clauses.join(',\n  ')}\n);`;
}

/** Builds a legacy schema: the manifest minus every migration-added column. */
function buildLegacyFixtureSql(): string {
  const statements: string[] = [];
  for (const table of SCHEMA_MANIFEST) {
    const added = new Set(MIGRATION_ADDED_COLUMNS[table.name] ?? []);
    const legacyColumns = table.columns.filter((column) => !added.has(column.name));
    statements.push(buildCreateTable(table, legacyColumns));
    for (const index of table.indexes) {
      if (index.name === null) continue; // already recreated by the UNIQUE constraint
      statements.push(
        `CREATE ${index.unique === 1 ? 'UNIQUE ' : ''}INDEX ${quoteIdent(index.name)} ` +
          `ON ${quoteIdent(table.name)} (${index.columns.map(quoteIdent).join(', ')});`
      );
    }
  }
  return statements.join('\n');
}

function insertLegacyRows(client: MinimalClient): void {
  client.execSync(`
    INSERT INTO categories (id, name, color, icon, created_at) VALUES (1, 'Strength', '#EF4444', 'x', 1000);
    INSERT INTO exercises (id, name, category_id, description, created_at) VALUES (1, 'Bench Press', 1, 'desc', 1000);
    INSERT INTO routine_folders (id, name, created_at) VALUES (1, 'Push', 1000);
    INSERT INTO routines (id, name, created_at) VALUES (1, 'Push Day', 1000);
    INSERT INTO routine_exercises (id, routine_id, exercise_id, "order") VALUES (1, 1, 1, 0);
    INSERT INTO sessions (id, started_at) VALUES (1, 1000);
    INSERT INTO session_exercises (id, session_id, exercise_id, "order") VALUES (1, 1, 1, 0);
    INSERT INTO sets (id, session_exercise_id, set_number, reps, weight, completed, created_at) VALUES (1, 1, 1, 8, 100, 0, 1000);
    INSERT INTO body_measurements (id, date, created_at) VALUES (1, 1000, 1000);
    INSERT INTO progress_photos (id, date, uri, created_at) VALUES (1, 1000, 'file:///photo.jpg', 1000);
  `);
}

describe(`SQLite schema freeze (SCHEMA_VERSION ${SCHEMA_VERSION})`, () => {
  it('SCHEMA_VERSION is a positive integer', () => {
    expect(Number.isInteger(SCHEMA_VERSION)).toBe(true);
    expect(SCHEMA_VERSION).toBeGreaterThan(0);
  });

  it('fresh install: CREATE_TABLES_SQL reaches SCHEMA_MANIFEST (migrations are a no-op)', () => {
    const { sqlite, client } = makeClient();
    client.execSync(CREATE_TABLES_SQL);
    runSchemaMigrations(client);

    expect(readShape(sqlite)).toEqual(SCHEMA_MANIFEST);
  });

  it('runSchemaMigrations emits exactly the columns MIGRATION_ADDED_COLUMNS declares', () => {
    const { client, statements } = makeClient();
    client.execSync(CREATE_TABLES_SQL);
    runSchemaMigrations(client);

    const emitted: Record<string, string[]> = {};
    for (const sql of statements.filter((statement) => /^ALTER TABLE/i.test(statement.trim()))) {
      const match = /^ALTER TABLE\s+(\S+)\s+ADD COLUMN\s+(\S+)/i.exec(sql.trim());
      expect(match).not.toBeNull();
      const [, table, column] = match as RegExpExecArray;
      if (!emitted[table]) emitted[table] = [];
      emitted[table].push(column.replace(/"/g, ''));
    }

    const expected: Record<string, string[]> = {};
    for (const [table, columns] of Object.entries(MIGRATION_ADDED_COLUMNS)) {
      expected[table] = [...columns].sort();
    }
    const actual: Record<string, string[]> = {};
    for (const [table, columns] of Object.entries(emitted)) actual[table] = [...columns].sort();

    expect(actual).toEqual(expected);
  });

  it('upgrade path: a legacy install reaches the frozen shape and keeps its rows', () => {
    const { sqlite, client } = makeClient();
    client.execSync('PRAGMA foreign_keys = OFF'); // mirrors an old install
    client.execSync(buildLegacyFixtureSql());

    // PRECONDITION: every migration-added column is genuinely absent, so a
    // manifest/ALTER drift cannot hide behind an already-present column.
    for (const [table, columns] of Object.entries(MIGRATION_ADDED_COLUMNS)) {
      const present = new Set(readColumns(sqlite, table).map((column) => column.name));
      for (const column of columns) {
        expect(present.has(column)).toBe(false);
      }
    }

    insertLegacyRows(client);
    runSchemaMigrations(client);

    expect(normalizeShape(readShape(sqlite))).toEqual(normalizeShape(SCHEMA_MANIFEST));

    // The inserted rows survive the migration, per table (literal SQL: table
    // names come from the manifest constant, never from user input).
    expect(sqlite.prepare('SELECT COUNT(*) AS c FROM categories').get()).toEqual({ c: 1 });
    expect(sqlite.prepare('SELECT COUNT(*) AS c FROM exercises').get()).toEqual({ c: 1 });
    expect(sqlite.prepare('SELECT COUNT(*) AS c FROM routine_folders').get()).toEqual({ c: 1 });
    expect(sqlite.prepare('SELECT COUNT(*) AS c FROM routines').get()).toEqual({ c: 1 });
    expect(sqlite.prepare('SELECT COUNT(*) AS c FROM routine_exercises').get()).toEqual({ c: 1 });
    expect(sqlite.prepare('SELECT COUNT(*) AS c FROM sessions').get()).toEqual({ c: 1 });
    expect(sqlite.prepare('SELECT COUNT(*) AS c FROM session_exercises').get()).toEqual({
      c: 1,
    });
    expect(sqlite.prepare('SELECT COUNT(*) AS c FROM sets').get()).toEqual({ c: 1 });
    expect(sqlite.prepare('SELECT COUNT(*) AS c FROM body_measurements').get()).toEqual({ c: 1 });
    expect(sqlite.prepare('SELECT COUNT(*) AS c FROM progress_photos').get()).toEqual({ c: 1 });
    expect(
      (sqlite.prepare('SELECT name FROM exercises WHERE id = 1').get() as { name: string }).name
    ).toBe('Bench Press');
    expect(
      (sqlite.prepare('SELECT uri FROM progress_photos WHERE id = 1').get() as { uri: string }).uri
    ).toBe('file:///photo.jpg');
  });

  it('runSchemaMigrations is idempotent', () => {
    const { sqlite, client } = makeClient();
    client.execSync(CREATE_TABLES_SQL);
    runSchemaMigrations(client);

    expect(() => runSchemaMigrations(client)).not.toThrow();
    expect(readShape(sqlite)).toEqual(SCHEMA_MANIFEST);
  });
});
