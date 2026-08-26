import type { WeightUnit } from './settings';
export type { WeightUnit };

/**
 * Resolve the display unit for an exercise: its own stored unit when it is a
 * valid weight unit, otherwise the global default from settings.
 */
export function resolveUnit(
  exerciseUnit: string | null | undefined,
  globalDefault: WeightUnit
): WeightUnit {
  return exerciseUnit === 'kg' || exerciseUnit === 'lbs' ? exerciseUnit : globalDefault;
}

/**
 * Format a weight value with its unit, e.g. `100 kg` / `220 lbs`.
 * Missing values render as an em dash.
 */
export function formatWeight(weight: number | null | undefined, unit: WeightUnit): string {
  if (weight == null) return '—';
  return `${weight} ${unit}`;
}