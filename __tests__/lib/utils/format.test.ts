import { formatDuration, formatRelativeDate, formatVolume } from '../../../lib/utils/format';

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

describe('formatRelativeDate', () => {
  it('returns "Today" for current date', () => {
    const today = new Date();
    expect(formatRelativeDate(today)).toBe('Today');
  });

  it('returns "Yesterday" for previous day', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatRelativeDate(yesterday)).toBe('Yesterday');
  });

  it('returns "X days ago" for recent dates', () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    expect(formatRelativeDate(threeDaysAgo)).toBe('3 days ago');
  });

  it('returns "X weeks ago" for older dates', () => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    expect(formatRelativeDate(twoWeeksAgo)).toBe('2 weeks ago');
  });

  it('handles string dates', () => {
    const today = new Date();
    expect(formatRelativeDate(today.toISOString())).toBe('Today');
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
