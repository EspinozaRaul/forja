// Single source of truth for routine/session target defaults.
export const DEFAULT_TARGET_SETS = 3;
export const DEFAULT_TARGET_REPS = 10;
export const DEFAULT_REST_SECONDS = 60;

/** Human-readable "N sets × R reps" label using the given targets (or defaults when null). */
export function formatSetsRepsLabel(sets: number | null | undefined, reps: number | null | undefined): string {
  return `${sets ?? DEFAULT_TARGET_SETS} sets × ${reps ?? DEFAULT_TARGET_REPS} reps`;
}