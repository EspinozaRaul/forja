import { formatDuration, formatRelativeDate, formatVolume } from '../../../lib/utils/format';
import { now } from '../../../lib/utils/date';

describe('formatDuration', () => {
  it('formats 0 seconds as 0:00', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('formats seconds under a minute', () => {
    expect(formatDuration(45)).toBe('0:45');
  });

  it('formats exactly one minute', () => {
    expect(formatDuration(60)).toBe('1:00');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(125)).toBe('2:05');
  });

  it('pads single digit seconds', () => {
    expect(formatDuration(61)).toBe('1:01');
  });

  it('formats large durations', () => {
    expect(formatDuration(3661)).toBe('61:01');
  });
});

/**
 * Language-dependent assertions run in the app's default language: jest.setup.js
 * pins expo-localization to `es`, which is also the i18n fallback language.
 */
describe('formatRelativeDate', () => {
  const daysAgo = (days: number) => {
    const d = now();
    d.setDate(d.getDate() - days);
    return d;
  };

  it('renders the current date as "today"', () => {
    expect(formatRelativeDate(now())).toBe('Hoy');
  });

  it('renders the previous day as "yesterday"', () => {
    expect(formatRelativeDate(daysAgo(1))).toBe('Ayer');
  });

  it('renders recent dates with a day count', () => {
    expect(formatRelativeDate(daysAgo(3))).toBe('Hace 3 días');
  });

  it('renders older dates with a week count', () => {
    expect(formatRelativeDate(daysAgo(14))).toBe('Hace 2 semanas');
  });

  it('handles string dates', () => {
    expect(formatRelativeDate(now().toISOString())).toBe('Hoy');
  });

  it('maps every branch to its i18n key with the right count', () => {
    const calls: Array<{ key: string; options?: unknown }> = [];
    const t = (key: string, options?: unknown) => {
      calls.push({ key, options });
      return key;
    };

    expect(formatRelativeDate(daysAgo(0), t)).toBe('common.today');
    expect(formatRelativeDate(daysAgo(1), t)).toBe('common.yesterday');
    expect(formatRelativeDate(daysAgo(3), t)).toBe('common.daysAgo');
    expect(formatRelativeDate(daysAgo(14), t)).toBe('common.weeksAgo');

    expect(calls).toEqual([
      { key: 'common.today', options: undefined },
      { key: 'common.yesterday', options: undefined },
      { key: 'common.daysAgo', options: { count: 3 } },
      { key: 'common.weeksAgo', options: { count: 2 } },
    ]);
  });
});

describe('formatVolume', () => {
  it('formats small volumes with one decimal', () => {
    expect(formatVolume(25.5)).toBe('25.5kg');
  });

  it('formats medium volumes rounded', () => {
    expect(formatVolume(150)).toBe('150kg');
  });

  it('formats large volumes in tons', () => {
    expect(formatVolume(1500)).toBe('1.5t');
  });

  it('formats exactly 100kg', () => {
    expect(formatVolume(100)).toBe('100kg');
  });

  it('formats 0kg', () => {
    expect(formatVolume(0)).toBe('0.0kg');
  });
});
