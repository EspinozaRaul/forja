import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import { categories } from './schema';

const DATABASE_NAME = 'fitness-tracker.db';

const expoDb = openDatabaseSync(DATABASE_NAME);

export const db = drizzle(expoDb);

const SEED_CATEGORIES = [
  { name: 'Strength', color: '#EF4444', icon: '💪' },
  { name: 'Cardio', color: '#3B82F6', icon: '🏃' },
  { name: 'Flexibility', color: '#8B5CF6', icon: '🧘' },
  { name: 'HIIT', color: '#F59E0B', icon: '⚡' },
];

export async function initializeDatabase() {
  // Run migrations via drizzle-kit push or manual SQL
  // For now, use drizzle-kit push for dev
  // In production, use migration files

  // Seed categories if empty
  const existing = await db.select().from(categories).limit(1);
  if (existing.length === 0) {
    const now = new Date();
    for (const cat of SEED_CATEGORIES) {
      await db.insert(categories).values({
        name: cat.name,
        color: cat.color,
        icon: cat.icon,
        createdAt: now,
      });
    }
  }
}
