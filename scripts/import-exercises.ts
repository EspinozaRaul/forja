import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import { exercises, categories } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

// Load the exercises dataset
const datasetPath = path.join(__dirname, '../../exercises-dataset/data/exercises.json');
const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

// Category mapping: dataset category -> our category name
const CATEGORY_MAP: Record<string, string> = {
  'chest': 'Strength',
  'back': 'Strength',
  'upper arms': 'Strength',
  'upper legs': 'Strength',
  'shoulders': 'Strength',
  'waist': 'Strength',
  'lower arms': 'Strength',
  'lower legs': 'Strength',
  'neck': 'Strength',
  'cardio': 'Cardio',
};

// Color and icon for each body part (for visual distinction)
const BODY_PART_CONFIG: Record<string, { color: string; icon: string }> = {
  'chest': { color: '#EF4444', icon: '💪' },
  'back': { color: '#3B82F6', icon: '🔙' },
  'upper arms': { color: '#8B5CF6', icon: '💪' },
  'upper legs': { color: '#F59E0B', icon: '🦵' },
  'shoulders': { color: '#10B981', icon: '🏋️' },
  'waist': { color: '#EC4899', icon: '🎯' },
  'lower arms': { color: '#6366F1', icon: '🤲' },
  'lower legs': { color: '#14B8A6', icon: '🦿' },
  'neck': { color: '#F97316', icon: '🦴' },
  'cardio': { color: '#EF4444', icon: '❤️' },
};

async function importExercises() {
  console.log('🚀 Starting exercise import...');
  console.log(`📊 Found ${dataset.length} exercises in dataset`);

  // Open database
  const expoDb = openDatabaseSync('fitness-tracker.db');
  const db = drizzle(expoDb);

  // Get existing categories
  const existingCategories = await db.select().from(categories);
  console.log(`📁 Found ${existingCategories.length} existing categories`);

  // Create a map of category name -> id
  const categoryMap: Record<string, number> = {};
  for (const cat of existingCategories) {
    categoryMap[cat.name] = cat.id;
  }

  // Create categories that don't exist
  const uniqueCategories = [...new Set(Object.values(CATEGORY_MAP))];
  for (const catName of uniqueCategories) {
    if (!categoryMap[catName]) {
      const config = BODY_PART_CONFIG[catName] || { color: '#6B7280', icon: '🏋️' };
      const result = await db.insert(categories).values({
        name: catName,
        color: config.color,
        icon: config.icon,
        createdAt: new Date(),
      }).returning();
      categoryMap[catName] = result[0].id;
      console.log(`✅ Created category: ${catName}`);
    }
  }

  // Import exercises
  let imported = 0;
  let skipped = 0;

  for (const exercise of dataset) {
    try {
      // Check if exercise already exists by original_id
      const existing = await db.select()
        .from(exercises)
        .where(eq(exercises.originalId, exercise.id))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Map category
      const categoryName = CATEGORY_MAP[exercise.category] || 'Strength';
      const categoryId = categoryMap[categoryName];

      // Get Spanish instructions
      const instructionsEs = exercise.instructions?.es || '';

      // Get secondary muscles as JSON string
      const secondaryMuscles = JSON.stringify(exercise.secondary_muscles || []);

      // Insert exercise
      await db.insert(exercises).values({
        name: exercise.name,
        categoryId,
        description: exercise.instructions?.en || '',
        equipment: exercise.equipment,
        targetMuscle: exercise.target,
        muscleGroup: exercise.muscle_group,
        secondaryMuscles,
        instructionsEs,
        imageUrl: exercise.image,
        gifUrl: exercise.gif_url,
        originalId: exercise.id,
        createdAt: new Date(),
      });

      imported++;
      if (imported % 100 === 0) {
        console.log(`📥 Imported ${imported} exercises...`);
      }
    } catch (error) {
      console.error(`❌ Error importing exercise ${exercise.id}:`, error);
      skipped++;
    }
  }

  console.log('\n✨ Import complete!');
  console.log(`✅ Imported: ${imported} exercises`);
  console.log(`⏭️ Skipped: ${skipped} exercises`);
  console.log(`📊 Total in database: ${imported + skipped}`);
}

// Run the import
importExercises().catch(console.error);
