import { useTranslation } from 'react-i18next';
import type { Exercise } from '../types';

/**
 * Hook to get the localized name of an exercise
 * Returns nameEs when language is Spanish, name otherwise
 */
export function useExerciseName() {
  const { i18n } = useTranslation();
  const isSpanish = i18n.language === 'es';

  const getExerciseName = (exercise: Exercise): string => {
    if (isSpanish && exercise.nameEs) {
      return exercise.nameEs;
    }
    return exercise.name;
  };

  return { getExerciseName, isSpanish };
}

/**
 * Get the localized name of an exercise (non-hook version)
 * Use this in contexts where hooks can't be used
 */
export function getLocalizedName(
  exercise: { name: string; nameEs?: string | null },
  language: string
): string {
  if (language === 'es' && exercise.nameEs) {
    return exercise.nameEs;
  }
  return exercise.name;
}

/**
 * Get the localized description of an exercise
 */
export function getLocalizedDescription(
  exercise: { description?: string | null; descriptionEs?: string | null },
  language: string
): string | null {
  if (language === 'es' && exercise.descriptionEs) {
    return exercise.descriptionEs;
  }
  return exercise.description;
}
