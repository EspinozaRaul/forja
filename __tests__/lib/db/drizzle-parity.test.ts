/**
 * Drizzle ↔ manifest parity.
 *
 * Two descriptions of the same SQLite schema exist and nothing else forces them
 * to agree:
 *
 *   * `lib/db/schema.ts` (drizzle) — what every typed query is written against,
 *   * `lib/db/schema-manifest.ts` (`SCHEMA_MANIFEST`) — the frozen contract that
 *     `lib/db/ddl.ts` (via `schema-freeze.test.ts`) is pinned to, i.e. what the
 *     database actually is.
 *
 * A column added to one and not the other drifts silently: a typed query would
 * reference a column that does not exist, or miss one that does. This suite
 * closes that gap by comparing the two declarations directly, without a
 * database — it is the drizzle-side companion to the SQLite freeze test.
 *
 * What is asserted:
 *   1. table-name set parity (no table on one side only),
 *   2. column-name set parity per table (both directions, reported precisely),
 *   3. nullability parity, with the SQLite `INTEGER PRIMARY KEY` exception,
 *   4. SQL-type parity for every non-primary-key column, and
 *   5. reverse: a manifest primary key is a drizzle `.primary`.
 *
 * Not asserted here: column defaults / indexes. Those are the freeze test's job
 * against the real database; this suite is narrowly about the names, types and
 * nullability a typed query can see.
 */

import { getTableColumns, getTableName, is, Table } from 'drizzle-orm';
import * as schema from '../../../lib/db/schema';
import { SCHEMA_MANIFEST } from '../../../lib/db/schema-manifest';

// Discover every drizzle table the schema module exports, keyed by its DB name.
// Discovered dynamically (not a hand-written list) so that a table added to
// `schema.ts` without a manifest entry fails test 1 instead of being invisible.
const DRIZZLE_TABLES = new Map<string, Table>();
for (const value of Object.values(schema)) {
  if (is(value, Table)) {
    DRIZZLE_TABLES.set(getTableName(value), value);
  }
}

function drizzleColumnsByName(table: Table): Map<string, { name: string; notNull: boolean; primary: boolean; sqlType: string }> {
  const columns = new Map<string, { name: string; notNull: boolean; primary: boolean; sqlType: string }>();
  for (const column of Object.values(getTableColumns(table))) {
    columns.set(column.name, {
      name: column.name,
      notNull: column.notNull,
      primary: column.primary,
      // `getSQLType()` is the concrete SQLite type (`integer` / `real` / `text`)
      // and, unlike `dataType`, it distinguishes INTEGER from REAL.
      sqlType: (column as unknown as { getSQLType(): string }).getSQLType(),
    });
  }
  return columns;
}

describe('drizzle schema ↔ SCHEMA_MANIFEST parity', () => {
  it('declares every table on both sides, and no table on only one', () => {
    const manifestNames = new Set(SCHEMA_MANIFEST.map((table) => table.name));
    const drizzleNames = new Set(DRIZZLE_TABLES.keys());

    const manifestOnly = [...manifestNames].filter((name) => !drizzleNames.has(name)).sort();
    const drizzleOnly = [...drizzleNames].filter((name) => !manifestNames.has(name)).sort();

    expect({ manifestOnly, drizzleOnly }).toEqual({ manifestOnly: [], drizzleOnly: [] });
  });

  it('matches column names per table in both directions', () => {
    const mismatches: string[] = [];

    for (const table of SCHEMA_MANIFEST) {
      const drizzleTable = DRIZZLE_TABLES.get(table.name);
      if (!drizzleTable) continue; // reported by the table-parity test

      const manifestNames = new Set(table.columns.map((column) => column.name));
      const drizzleNames = new Set(drizzleColumnsByName(drizzleTable).keys());

      const manifestOnly = [...manifestNames].filter((name) => !drizzleNames.has(name)).sort();
      const drizzleOnly = [...drizzleNames].filter((name) => !manifestNames.has(name)).sort();

      if (manifestOnly.length > 0 || drizzleOnly.length > 0) {
        mismatches.push(
          `${table.name}: manifest-only [${manifestOnly.join(', ')}] · drizzle-only [${drizzleOnly.join(', ')}]`
        );
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('agrees on nullability for every non-primary-key column', () => {
    const mismatches: string[] = [];

    for (const table of SCHEMA_MANIFEST) {
      const drizzleTable = DRIZZLE_TABLES.get(table.name);
      if (!drizzleTable) continue;

      const drizzleColumns = drizzleColumnsByName(drizzleTable);
      for (const column of table.columns) {
        // SQLite's `PRAGMA table_info` reports `notnull = 0` for an
        // `INTEGER PRIMARY KEY` (the column is rowid, not declared NOT NULL),
        // while drizzle's `.primaryKey()` implies not-null. The rowid primary
        // key is covered by the reverse assertion below, not by nullability.
        if (column.pk === 1) continue;

        const drizzleColumn = drizzleColumns.get(column.name);
        if (!drizzleColumn) continue; // reported by the column-parity test

        const manifestNotNull = column.notNull === 1;
        if (manifestNotNull !== drizzleColumn.notNull) {
          mismatches.push(
            `${table.name}.${column.name}: manifest notNull=${column.notNull} but drizzle notNull=${drizzleColumn.notNull}`
          );
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('matches the SQL type of every non-primary-key column', () => {
    const mismatches: string[] = [];

    for (const table of SCHEMA_MANIFEST) {
      const drizzleTable = DRIZZLE_TABLES.get(table.name);
      if (!drizzleTable) continue; // reported by the table-parity test

      const drizzleColumns = drizzleColumnsByName(drizzleTable);
      for (const column of table.columns) {
        // Same `INTEGER PRIMARY KEY` rowid exception as nullability: the pk is
        // covered by the dedicated reverse assertion below, so it is skipped,
        // not mapped.
        if (column.pk === 1) continue;

        const drizzleColumn = drizzleColumns.get(column.name);
        if (!drizzleColumn) continue; // reported by the column-parity test

        // Drop any length suffix (`text(255)`) before comparing to the manifest's
        // bare SQLite type.
        const drizzleType = drizzleColumn.sqlType.replace(/\(.*\)$/, '').toUpperCase();
        if (drizzleType !== column.type) {
          mismatches.push(
            `${table.name}.${column.name}: manifest type=${column.type} but drizzle getSQLType()=${drizzleColumn.sqlType}`
          );
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('marks every manifest primary-key column as a drizzle primary key', () => {
    const mismatches: string[] = [];

    for (const table of SCHEMA_MANIFEST) {
      const drizzleTable = DRIZZLE_TABLES.get(table.name);
      if (!drizzleTable) continue;

      const drizzleColumns = drizzleColumnsByName(drizzleTable);
      for (const column of table.columns) {
        if (column.pk !== 1) continue;

        const drizzleColumn = drizzleColumns.get(column.name);
        if (!drizzleColumn) continue; // reported by the column-parity test

        if (drizzleColumn.primary !== true) {
          mismatches.push(`${table.name}.${column.name}: manifest pk=1 but drizzle .primary=${drizzleColumn.primary}`);
        }
      }
    }

    expect(mismatches).toEqual([]);
  });
});
