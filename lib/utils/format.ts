/**
 * Format seconds into MM:SS display
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format a date to a relative string using i18n
 */
export function formatRelativeDate(date: Date | string, t?: (key: string, options?: Record<string, unknown>) => string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return t ? t('common.today') : 'Hoy';
  if (diffDays === 1) return t ? t('common.yesterday') : 'Ayer';
  if (diffDays < 7) return t ? t('common.daysAgo', { count: diffDays }) : `Hace ${diffDays} días`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return t ? t('common.weeksAgo', { count: weeks }) : `Hace ${weeks} semanas`;
  }
  return d.toLocaleDateString();
}

import type { WeightUnit } from './weight-unit';
import { now } from '../utils/date';

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
