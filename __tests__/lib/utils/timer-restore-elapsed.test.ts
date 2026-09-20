import {
  computeRestoredElapsed,
  type SessionTimerState,
} from '../../../lib/utils/timer-persistence';

function savedState(overrides: Partial<SessionTimerState> = {}): SessionTimerState {
  return {
    sessionId: 'session-1',
    startTimestamp: 1_000_000,
    pausedElapsed: 0,
    isRunning: false,
    ...overrides,
  };
}

describe('computeRestoredElapsed (bug C2: restore must absorb accumulated time)', () => {
  it('adds the gap since the saved start when the timer was running', () => {
    // 30 s already banked, 45 s elapsed before the app was killed and reopened.
    const saved = savedState({ startTimestamp: 1_000_000, pausedElapsed: 30, isRunning: true });

    expect(computeRestoredElapsed(saved, 1_045_000)).toBe(75);
  });

  it('keeps only the banked elapsed when the timer was paused', () => {
    const saved = savedState({ startTimestamp: 1_000_000, pausedElapsed: 42, isRunning: false });

    // Even a large wall-clock gap must not be added while paused.
    expect(computeRestoredElapsed(saved, 9_999_999)).toBe(42);
  });

  it('returns zero when there is no saved state', () => {
    expect(computeRestoredElapsed(null, 1_000_000)).toBe(0);
    expect(computeRestoredElapsed(undefined, 1_000_000)).toBe(0);
  });

  it('returns the banked elapsed for a running timer restored at the same instant', () => {
    const saved = savedState({ startTimestamp: 1_000_000, pausedElapsed: 12, isRunning: true });

    expect(computeRestoredElapsed(saved, 1_000_000)).toBe(12);
  });

  it('floors sub-second gaps, matching the live tick arithmetic', () => {
    const saved = savedState({ startTimestamp: 1_000_000, pausedElapsed: 5, isRunning: true });

    expect(computeRestoredElapsed(saved, 1_001_900)).toBe(6);
  });

  it('handles a long app-kill gap on top of earlier paused time', () => {
    // 5 min banked after previous pauses, 2 h of wall clock before reopening.
    const saved = savedState({ startTimestamp: 2_000_000, pausedElapsed: 300, isRunning: true });

    expect(computeRestoredElapsed(saved, 2_000_000 + 2 * 60 * 60 * 1000)).toBe(300 + 2 * 60 * 60);
  });
});
