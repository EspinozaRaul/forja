import type { Set } from '../types';

/**
 * Decides whether typing `weight` should celebrate a new record.
 * Celebrates when the typed weight beats ANY of the three marks:
 *  - previousSetWeight: the previous set in the current session
 *  - placeholderWeight: the visible "peso previo" placeholder mark users read
 *  - maxWeight: the all-time max recorded for the exercise
 */
export function shouldCelebrateNewRecord(
  weight: number,
  previousSetWeight: number | null,
  placeholderWeight: number | null,
  maxWeight: number | null
): boolean {
  if (weight <= 0) return false;
  return (
    (previousSetWeight != null && weight > previousSetWeight) ||
    (placeholderWeight != null && weight > placeholderWeight) ||
    (maxWeight != null && weight > maxWeight)
  );
}

/**
 * Returns the weight of the most recent qualifying earlier set for the same
 * session-exercise, to compare against for the "new record" celebration.
 * Qualifying: a set other than the one being updated, with a weight > 0, that
 * is a real "visible" row (parent of a grouped method or plain linear; drop
 * children excluded). Returns null when no such earlier set exists.
 *
 * NOTE: in the DB, a plain linear set has dropOrder = 0 (schema default) and
 * isDropGroup = false; drop children have dropOrder >= 1. The mapper also
 * normalizes null to 0, so always treat 0 as "not a drop child".
 */
export function findPreviousSetWeight(
  sets: Set[],
  currentSetId: number
): number | null {
  const currentSet = sets.find((s) => s.id === currentSetId);
  if (!currentSet) return null;

  const candidates = sets.filter(
    (s) =>
      s.id !== currentSetId &&
      (s.setNumber ?? 0) < (currentSet.setNumber ?? 0) &&
      s.weight != null &&
      s.weight > 0 &&
      (s.isDropGroup === true || s.dropOrder == null || s.dropOrder === 0)
  );
  if (candidates.length === 0) return null;

  // Return the heaviest qualifying earlier set (most recent high-water mark)
  let best = candidates[0];
  for (const s of candidates) {
    if ((s.weight ?? 0) > (best.weight ?? 0)) {
      best = s;
    }
  }
  return best.weight;
}