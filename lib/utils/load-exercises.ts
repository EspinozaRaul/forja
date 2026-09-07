import { importExercisesFromDataset } from '../db/import-exercises';

// This function will be called on app startup to import exercises
// It loads the dataset from the bundled JSON file
export async function loadAndImportExercises() {
  try {
    // In React Native, we can require JSON files directly
    // The JSON file should be in the assets folder
    const dataset = require('../../assets/exercises/data/exercises.json');
    
    if (__DEV__) console.log(`📚 Loaded ${dataset.length} exercises from dataset`);
    
    // Import into database
    const result = await importExercisesFromDataset(dataset);
    
    return result;
  } catch (error) {
    if (__DEV__) console.error('❌ Error loading exercises dataset:', error);
    throw error;
  }
}
