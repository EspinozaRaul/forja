// Web mock database — in-memory stores with Drizzle-like query builder
// This file is only used on web (Metro resolves .web.ts over .ts)

import { categories } from './schema';

// ─── In-memory stores ──────────────────────────────────
let nextId = 100;
const tables: Record<string, any[]> = {
  categories: [],
  exercises: [],
  routines: [],
  routine_exercises: [],
  sessions: [],
  session_exercises: [],
  sets: [],
};

const TABLE_NAME_MAP = new Map<any, string>();
TABLE_NAME_MAP.set(categories, 'categories');

function getTableName(table: any): string {
  return TABLE_NAME_MAP.get(table) ?? table?.name ?? 'unknown';
}

// ─── Mock query builder ────────────────────────────────
function createQueryBuilder(tableName: string) {
  let data = [...(tables[tableName] ?? [])];
  let filterFn: ((row: any) => boolean) | null = null;
  let limitCount: number | null = null;
  let orderByFn: ((a: any, b: any) => number) | null = null;
  let joinInfo: { table: string; on: (row: any, joined: any) => boolean } | null = null;

  const builder: any = {
    from(table: any) {
      const name = getTableName(table);
      tableName = name;
      data = [...(tables[name] ?? [])];
      // Store table reference for schema-based field access
      builder._table = table;
      builder._tableName = name;
      return builder;
    },
    where(condition: any) {
      // Drizzle eq() returns { [columnSymbol]: value } or a function
      if (typeof condition === 'function') {
        filterFn = condition;
      } else if (condition && typeof condition === 'object') {
        // Extract the column-value pairs from Drizzle's eq() output
        const entries = Object.entries(condition);
        if (entries.length > 0) {
          const [key, value] = entries[0];
          filterFn = (row: any) => row[key] === value;
        }
      }
      return builder;
    },
    limit(n: number) {
      limitCount = n;
      return builder;
    },
    orderBy(orderFn: any) {
      orderByFn = orderFn;
      return builder;
    },
    innerJoin(table: any, onCondition: any) {
      const joinTableName = getTableName(table);
      joinInfo = { table: joinTableName, on: onCondition };
      return builder;
    },
    returning() {
      return builder;
    },
    then(resolve: any) {
      let result = [...data];

      // Apply join
      if (joinInfo) {
        const joinedData = tables[joinInfo.table] ?? [];
        result = result.flatMap((row) =>
          joinedData
            .filter((j) => joinInfo!.on(row, j))
            .map((j) => ({ ...row, ...j }))
        );
      }

      // Apply filter
      if (filterFn) {
        result = result.filter(filterFn);
      }

      // Apply order
      if (orderByFn) {
        result.sort(orderByFn);
      }

      // Apply limit
      if (limitCount !== null) {
        result = result.slice(0, limitCount);
      }

      resolve(result);
    },
  };

  // Proxy for .select().from() pattern
  const proxy = new Proxy(builder, {
    get(target, prop) {
      if (prop === 'then') {
        return target.then;
      }
      if (prop === 'select') {
        return () => builder;
      }
      return target[prop];
    },
  });

  return proxy;
}

// ─── Mock db object ────────────────────────────────────
function select() {
  return {
    from(table: any) {
      return createQueryBuilder(getTableName(table));
    },
  };
}

function insert(table: any) {
  const tableName = getTableName(table);
  return {
    values(data: any) {
      const row = { id: nextId++, ...data };
      tables[tableName].push(row);
      return {
        returning() {
          return {
            then(resolve: any) {
              resolve([row]);
            },
          };
        },
        then(resolve: any) {
          resolve([row]);
        },
      };
    },
  };
}

function update(table: any) {
  const tableName = getTableName(table);
  return {
    set(data: any) {
      return {
        where(condition: any) {
          let filter: (row: any) => boolean;
          if (typeof condition === 'function') {
            filter = condition;
          } else if (condition && typeof condition === 'object') {
            const entries = Object.entries(condition);
            const [key, value] = entries[0];
            filter = (row: any) => row[key] === value;
          } else {
            filter = () => true;
          }

          return {
            returning() {
              const updated: any[] = [];
              tables[tableName] = tables[tableName].map((row) => {
                if (filter(row)) {
                  const newRow = { ...row, ...data };
                  updated.push(newRow);
                  return newRow;
                }
                return row;
              });
              return {
                then(resolve: any) {
                  resolve(updated);
                },
              };
            },
            then(resolve: any) {
              tables[tableName] = tables[tableName].map((row) =>
                filter(row) ? { ...row, ...data } : row
              );
              resolve(undefined);
            },
          };
        },
      };
    },
  };
}

function del(table: any) {
  const tableName = getTableName(table);
  return {
    where(condition: any) {
      let filter: (row: any) => boolean;
      if (typeof condition === 'function') {
        filter = condition;
      } else if (condition && typeof condition === 'object') {
        const entries = Object.entries(condition);
        const [key, value] = entries[0];
        filter = (row: any) => row[key] === value;
      } else {
        filter = () => true;
      }
      tables[tableName] = tables[tableName].filter((row) => !filter(row));
      return {
        then(resolve: any) {
          resolve(undefined);
        },
      };
    },
  };
}

export const db = { select, insert, update, delete: del };

// ─── Seed data ─────────────────────────────────────────
import { SEED_EXERCISES as FULL_SEED_EXERCISES } from './seed-exercises';
import { now } from '../utils/date';

const SEED_CATEGORIES = [
  { name: 'Strength', color: '#EF4444', icon: '💪' },
  { name: 'Cardio', color: '#3B82F6', icon: '🏃' },
  { name: 'Flexibility', color: '#8B5CF6', icon: '🧘' },
  { name: 'HIIT', color: '#F59E0B', icon: '⚡' },
];

const CATEGORY_MAP: Record<string, number> = {
  'Strength': 1,
  'Cardio': 2,
  'Flexibility': 3,
  'HIIT': 4,
};

export async function initializeDatabase() {
  if (tables.categories.length > 0) return; // Already seeded

  const now = new Date();

  // Seed categories
  for (const cat of SEED_CATEGORIES) {
    tables.categories.push({ id: nextId++, ...cat, created_at: now });
  }

  // Seed exercises from comprehensive database
  for (const ex of FULL_SEED_EXERCISES) {
    tables.exercises.push({
      id: nextId++,
      name: ex.name,
      category_id: CATEGORY_MAP[ex.category] ?? 1,
      description: ex.description,
      created_at: now,
    });
  }

  // Seed sample routines
  tables.routines.push(
    { id: nextId++, name: 'Push Day', description: 'Chest, shoulders, triceps', category_id: 1, created_at: now },
    { id: nextId++, name: 'Pull Day', description: 'Back, biceps', category_id: 1, created_at: now },
    { id: nextId++, name: 'Leg Day', description: 'Quads, hamstrings, glutes, calves', category_id: 1, created_at: now },
    { id: nextId++, name: 'Cardio Blast', description: '20 min HIIT session', category_id: 4, created_at: now }
  );

  if (__DEV__) console.log('[Web Mock DB] Seeded with', FULL_SEED_EXERCISES.length, 'exercises');
}
