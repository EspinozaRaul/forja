import type { WeightUnit } from './weight-unit';
import { now } from './date';
import i18n from '../i18n';
import type { TOptions } from 'i18next';

type TranslateFn = (key: string, options?: TOptions) => string;

const defaultTranslate: TranslateFn = (key, options) => i18n.t(key, options);

/**
 * Format seconds into MM:SS display
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format a date to a relative string using i18n. Every branch goes through the
 * translator, so there are no language-specific literals here: a missing key
 * falls back to the app language rather than to a hardcoded string.
 */
export function formatRelativeDate(
  date: Date | string,
  t: TranslateFn = defaultTranslate
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now().getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return t('common.today');
  if (diffDays === 1) return t('common.yesterday');
  if (diffDays < 7) return t('common.daysAgo', { count: diffDays });
  if (diffDays < 30) return t('common.weeksAgo', { count: Math.floor(diffDays / 7) });
  return d.toLocaleDateString();
}

/**
 * Format volume with appropriate precision for the given unit. Aggregates mix
 * units, so callers pass the unit they want the label shown in; numbers are
 * never converted.
 */
export function formatVolume(volume: number, unit: WeightUnit = 'kg'): string {
  if (unit === 'lbs') {
    if (volume >= 100) return `${Math.round(volume)} lbs`;
    return `${volume.toFixed(1)} lbs`;
  }
  if (volume >= 1000) {
    return `${(volume / 1000).toFixed(1)}t`;
  }
  if (volume >= 100) {
    return `${Math.round(volume)}kg`;
  }
  return `${volume.toFixed(1)}kg`;
}
