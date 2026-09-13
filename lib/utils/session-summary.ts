import type { Set } from '../types';
import i18n from '../i18n';
import type { TOptions } from 'i18next';

/**
 * Translator shape used by the summary helpers. Defaults to the app i18n
 * instance; injectable so callers (and tests) can pin a language explicitly.
 */
export type TranslateFn = (key: string, options?: TOptions) => string;

const defaultTranslate: TranslateFn = (key, options) => i18n.t(key, options);

/**
 * Maps a grouped intensity method to the i18n key holding its badge label
 * ("Drop", "Segmento"). Unknown methods fall back to the segmented label,
 * matching the previous hardcoded behaviour.
 */
function groupLabelKey(method: string | null): string {
  if (method === 'dropset') return 'methods.dropset.unitLabel';
  if (method === 'cluster') return 'methods.cluster.unitLabel';
  return 'methods.rest_pause.unitLabel';
}

/**
 * Summarize a list of sets for compact display (e.g., the "last session" card
 * shown before starting a session). Drop / rest-pause / cluster groups are
 * collapsed into a single "Drop × N" / "Segmento × N" line instead of listing
 * every parent + drop row, which visually repeats the same exercise many times.
 */

export interface SetSummaryLine {
  type: 'group' | 'set';
  /** group: method badge (Drop / Segmento). set: null */
  label: string | null;
  /** group: number of rows in the group (parent + drops). set: null */
  count: number | null;
  /** original DB setNumber (first row of the group, or the linear set) */
  setNumber: number | null;
  /** set: reps value (may be null) */
  reps: number | null;
  /** set: weight value (may be null) */
  weight: number | null;
}

const GROUP_METHODS = ['dropset', 'rest_pause', 'cluster'];

export function summarizeSets(sets: Set[], t: TranslateFn = defaultTranslate): SetSummaryLine[] {
  if (!sets || sets.length === 0) return [];

  // Group rows that belong to an intensity-method group: same setNumber + method.
  const grouped = new Map<string, Set[]>();
  const linears: Set[] = [];

  for (const s of sets) {
    const isGroupMethod = GROUP_METHODS.includes(s.method ?? '');
    if (isGroupMethod && s.setNumber != null) {
      const key = `${s.setNumber}:${s.method}`;
      const list = grouped.get(key) ?? [];
      list.push(s);
      grouped.set(key, list);
    } else {
      linears.push(s);
    }
  }

  const lines: SetSummaryLine[] = [];

  for (const rows of grouped.values()) {
    // Keep insertion order stable: sort by setNumber (copy to avoid mutating input)
    const sorted = [...rows].sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0));
    const first = sorted[0];
    lines.push({
      type: 'group',
      label: t(groupLabelKey(first.method)),
      count: sorted.length,
      setNumber: first.setNumber,
      reps: null,
      weight: null,
    });
  }

  for (const s of linears) {
    lines.push({
      type: 'set',
      label: null,
      count: null,
      setNumber: s.setNumber,
      reps: s.reps,
      weight: s.weight,
    });
  }

  return lines.sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0));
}
