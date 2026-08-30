import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_TIMER_KEY = 'session_timer_state';
const REST_TIMER_KEY = 'rest_timer_state';

export interface SessionTimerState {
  sessionId: string;
  startTimestamp: number; // Date.now() when timer started
  pausedElapsed: number; // elapsed seconds when paused (0 if running)
  isRunning: boolean;
}

export interface RestTimerState {
  sessionId: string;
  endTimestamp: number; // Date.now() when countdown ends
  totalDuration: number; // original duration in seconds
  isRunning: boolean;
}

// --- Session Timer ---

export async function saveSessionTimer(state: SessionTimerState): Promise<void> {
  await AsyncStorage.setItem(SESSION_TIMER_KEY, JSON.stringify(state));
}

export async function loadSessionTimer(sessionId: string): Promise<SessionTimerState | null> {
  const raw = await AsyncStorage.getItem(SESSION_TIMER_KEY);
  if (!raw) return null;
  try {
    const state: SessionTimerState = JSON.parse(raw);
    if (state.sessionId !== sessionId) return null;
    return state;
  } catch {
    await AsyncStorage.removeItem(SESSION_TIMER_KEY);
    return null;
  }
}

export async function clearSessionTimer(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_TIMER_KEY);
}

/**
 * Calculate elapsed seconds based on persisted state.
 * If running, computes from startTimestamp. If paused, returns pausedElapsed.
 */
export function calculateSessionElapsed(state: SessionTimerState): number {
  if (state.isRunning) {
    const now = Date.now();
    const elapsedSinceStart = Math.floor((now - state.startTimestamp) / 1000);
    return state.pausedElapsed + elapsedSinceStart;
  }
  return state.pausedElapsed;
}

// --- Rest Timer ---

export async function saveRestTimer(state: RestTimerState): Promise<void> {
  await AsyncStorage.setItem(REST_TIMER_KEY, JSON.stringify(state));
}

export async function loadRestTimer(sessionId: string): Promise<RestTimerState | null> {
  const raw = await AsyncStorage.getItem(REST_TIMER_KEY);
  if (!raw) return null;
  try {
    const state: RestTimerState = JSON.parse(raw);
    if (state.sessionId !== sessionId) return null;
    return state;
  } catch {
    await AsyncStorage.removeItem(REST_TIMER_KEY);
    return null;
  }
}

export async function clearRestTimer(): Promise<void> {
  await AsyncStorage.removeItem(REST_TIMER_KEY);
}

/**
 * Calculate remaining seconds based on persisted state.
 * If running, computes from endTimestamp. If not running, returns 0.
 */
export function calculateRestRemaining(state: RestTimerState): number {
  if (!state.isRunning) return 0;
  const now = Date.now();
  const remaining = Math.ceil((state.endTimestamp - now) / 1000);
  return Math.max(0, remaining);
}
