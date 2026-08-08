#!/usr/bin/env node
/**
 * Import exercises from dataset to Supabase
 * Run: npx tsx scripts/import-to-supabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load from .env
const envPath = resolve(__dirname, '../.env');
const envContent = readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length) env[key.trim()] = value.join('=').trim();
});

const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Category mapping: dataset category -> our category
const CATEGORY_MAP: Record<string, { name: string; color: string; icon: string }> = {
  'chest': { name: 'Strength', color: '#EF4444', icon: '💪' },
  'back': { name: 'Strength', color: '#EF4444', icon: '💪' },
  'upper arms': { name: 'Strength', color: '#EF4444', icon: '💪' },
  'upper legs': { name: 'Strength', color: '#EF4444', icon: '💪' },
  'shoulders': { name: 'Strength', color: '#EF4444', icon: '💪' },
  'waist': { name: 'Core', color: '#EC4899', icon: '🎯' },
  'lower arms': { name: 'Strength', color: '#EF4444', icon: '💪' },
  'lower legs': { name: 'Strength', color: '#EF4444', icon: '💪' },
  'neck': { name: 'Strength', color: '#EF4444', icon: '💪' },
  'cardio': { name: 'Cardio', color: '#3B82F6', icon: '🏃' },
};

interface DatasetExercise {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  instructions: { es?: string; en?: string; [key: string]: string | undefined };
  muscle_group: string;
  secondary_muscles: string[];
  target: string;
  image: string;
  gif_url: string;
}

async function main() {
  console.log('🚀 Starting exercise import to Supabase...\n');

  // 1. Load dataset
  const datasetPath = resolve('/tmp/exercises-dataset/data/exercises.json');
  const raw = readFileSync(datasetPath, 'utf-8');
  const dataset: DatasetExercise[] = JSON.parse(raw);
  console.log(`📊 Loaded ${dataset.length} exercises from dataset`);

  // 2. Get or create categories
  console.log('\n📁 Setting up categories...');
  const { data: existingCats } = await supabase.from('categories').select('*');
  const categoryMap: Record<string, number> = {};

  if (existingCats && existingCats.length > 0) {
    for (const cat of existingCats) {
      categoryMap[cat.name] = cat.id;
    }
    console.log(`   Found ${existingCats.length} existing categories`);
  }

  // Create missing categories
  const uniqueCategories = [...new Set(Object.values(CATEGORY_MAP).map(c => c.name))];
  for (const catName of uniqueCategories) {
    if (!categoryMap[catName]) {
      const config = Object.values(CATEGORY_MAP).find(c => c.name === catName)!;
      const { data, error } = await supabase.from('categories').insert({
        name: catName,
        color: config.color,
        icon: config.icon,
      }).select().single();

      if (error) {
        console.error(`   ❌ Error creating category ${catName}:`, error.message);
      } else {
        categoryMap[catName] = data.id;
        console.log(`   ✅ Created category: ${catName}`);
      }
    }
  }

  console.log('   Category map:', categoryMap);

  // 3. Check existing exercises
  const { count: existingCount } = await supabase
    .from('exercises')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📈 Existing exercises in Supabase: ${existingCount || 0}`);

  // 4. Import exercises in batches
  const BATCH_SIZE = 50;
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < dataset.length; i += BATCH_SIZE) {
    const batch = dataset.slice(i, i + BATCH_SIZE);

    const exercises = batch.map(ex => {
      const categoryName = CATEGORY_MAP[ex.category]?.name || 'Strength';
      const categoryId = categoryMap[categoryName];

      return {
        name: ex.name,
        category_id: categoryId,
        description: ex.instructions?.en || '',
        equipment: ex.equipment,
        target_muscle: ex.target,
        muscle_group: ex.muscle_group,
        secondary_muscles: ex.secondary_muscles || [],
        instructions_es: ex.instructions?.es || '',
        image_url: ex.image,
        gif_url: ex.gif_url,
        original_id: ex.id,
      };
    });

    const { data, error } = await supabase
      .from('exercises')
      .upsert(exercises, { onConflict: 'original_id', ignoreDuplicates: true })
      .select();

    if (error) {
      console.error(`   ❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
      errors += batch.length;
    } else {
      imported += data?.length || 0;
      skipped += batch.length - (data?.length || 0);
    }

    // Progress
    const progress = Math.min(100, Math.round(((i + BATCH_SIZE) / dataset.length) * 100));
    process.stdout.write(`\r   📥 Progress: ${progress}% (${imported} imported, ${skipped} skipped)`);
  }

  console.log('\n\n✨ Import complete!');
  console.log(`   ✅ Imported: ${imported} exercises`);
  console.log(`   ⏭️  Skipped: ${skipped} exercises`);
  console.log(`   ❌ Errors: ${errors} exercises`);
  console.log(`   📊 Total in dataset: ${dataset.length}`);

  // 5. Verify
  const { count: finalCount } = await supabase
    .from('exercises')
    .select('*', { count: 'exact', head: true });

  console.log(`   📈 Total in Supabase: ${finalCount}`);
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
