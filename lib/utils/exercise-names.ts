import { EXERCISE_NAMES_ES } from '../db/exercise-names-es';

/**
 * Resolve exercise display name based on language.
 * EN: return the key (English name)
 * ES: return the value (Spanish name from EXERCISE_NAMES_ES)
 */
export function getExerciseName(name: string, lang: string): string {
  if (lang === 'en') {
    return name;
  }
  return EXERCISE_NAMES_ES[name] || name;
}
