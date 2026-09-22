/**
 * Superset grouping — the predicate that decides which session exercises render as
 * a super set, extracted from `app/session/[id].tsx`.
 *
 * A super set is renderable only when its `supersetPairId` is shared by exactly TWO
 * rows: `SupersetBlock` reads `exercises[0]` and `exercises[1]` and nothing else. The
 * screen used to send every other size down the standalone path behind a source
 * comment, so a pair id shared by one or three rows silently disappeared from the UI
 * and stayed in the database where no control could remove it.
 *
 * This helper names that case instead: it classifies every row and reports the pair
 * ids whose member count cannot render, so the caller can dissolve them deliberately.
 */

/** The minimum shape a row needs to take part in a super set. */
export interface SupersetMember {
  id: number;
  supersetPairId: number | null;
}

/** One rendered row: either a renderable pair, or a single exercise. */
export type SupersetRenderRow<T extends SupersetMember> =
  | { kind: 'pair'; pairId: number; members: [T, T] }
  | { kind: 'standalone'; exercise: T };

export interface SupersetRenderPlan<T extends SupersetMember> {
  /** Rows in input order. A pair renders once, at its first member's position. */
  rows: SupersetRenderRow<T>[];
  /**
   * Pair ids shared by a number of rows other than two. They cannot render as a
   * `SupersetBlock`; callers should dissolve the pairing rather than leave it behind.
   */
  unrenderablePairIds: number[];
}

/**
 * Groups `exercises` (already in display order) into pair rows and standalone rows.
 * Pure: no React, no database, no I/O.
 */
export function planSupersetRows<T extends SupersetMember>(
  exercises: readonly T[]
): SupersetRenderPlan<T> {
  const groups = new Map<number, T[]>();
  for (const sessionExercise of exercises) {
    if (sessionExercise.supersetPairId == null) continue;
    const members = groups.get(sessionExercise.supersetPairId) ?? [];
    members.push(sessionExercise);
    groups.set(sessionExercise.supersetPairId, members);
  }

  const unrenderablePairIds: number[] = [];
  for (const [pairId, members] of groups) {
    if (members.length !== 2) unrenderablePairIds.push(pairId);
  }

  const rows: SupersetRenderRow<T>[] = [];
  const renderedPairIds = new Set<number>();
  for (const sessionExercise of exercises) {
    const pairId = sessionExercise.supersetPairId;
    if (pairId == null || (groups.get(pairId)?.length ?? 0) !== 2) {
      rows.push({ kind: 'standalone', exercise: sessionExercise });
      continue;
    }
    if (renderedPairIds.has(pairId)) continue;
    renderedPairIds.add(pairId);
    const [first, second] = groups.get(pairId) as [T, T];
    rows.push({ kind: 'pair', pairId, members: [first, second] });
  }

  return { rows, unrenderablePairIds };
}
