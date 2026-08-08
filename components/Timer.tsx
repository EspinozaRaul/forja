import { View, Text, TouchableOpacity, AppState, type AppStateStatus } from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { colors, spacing, borderRadius } from '../lib/theme/tokens';
import {
  saveSessionTimer,
  loadSessionTimer,
  clearSessionTimer,
  calculateSessionElapsed,
  type SessionTimerState,
} from '../lib/utils/timer-persistence';

interface TimerProps {
  sessionId?: string;
  onTimeUpdate?: (seconds: number) => void;
  autoStart?: boolean;
}

function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function Timer({ sessionId, onTimeUpdate, autoStart = false }: TimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimestampRef = useRef<number>(0);
  const pausedElapsedRef = useRef<number>(0);
  const sessionIdRef = useRef(sessionId);

  // Keep session ID ref fresh
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Notify parent of elapsed time changes
  useEffect(() => {
    onTimeUpdate?.(elapsed);
  }, [elapsed, onTimeUpdate]);

  // Calculate elapsed from timestamp
  const recalculateElapsed = useCallback(() => {
    if (running && startTimestampRef.current > 0) {
      const now = Date.now();
      const elapsedSinceStart = Math.floor((now - startTimestampRef.current) / 1000);
      setElapsed(pausedElapsedRef.current + elapsedSinceStart);
    }
  }, [running]);

  // AppState listener — recalculate when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        recalculateElapsed();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [recalculateElapsed]);

  // Restore state on mount
  useEffect(() => {
    if (!sessionId) return;

    loadSessionTimer(sessionId).then((saved) => {
      if (!saved) {
        // No saved state — start fresh if autoStart
        if (autoStart) {
          const now = Date.now();
          startTimestampRef.current = now;
          pausedElapsedRef.current = 0;
          setRunning(true);
          setElapsed(0);
          saveSessionTimer({
            sessionId,
            startTimestamp: now,
            pausedElapsed: 0,
            isRunning: true,
          });
        }
        return;
      }

      // Restore from saved state
      startTimestampRef.current = saved.startTimestamp;
      pausedElapsedRef.current = saved.pausedElapsed;
      setRunning(saved.isRunning);
      setElapsed(calculateSessionElapsed(saved));
    });
  }, [sessionId, autoStart]);

  // Interval for live updates when running
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        recalculateElapsed();
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, recalculateElapsed]);

  // Persist state on changes
  useEffect(() => {
    if (!sessionId) return;
    saveSessionTimer({
      sessionId,
      startTimestamp: startTimestampRef.current,
      pausedElapsed: pausedElapsedRef.current,
      isRunning: running,
    });
  }, [running, sessionId]);

  const handleStart = () => {
    startTimestampRef.current = Date.now();
    pausedElapsedRef.current = elapsed;
    setRunning(true);
  };

  const handleStop = () => {
    pausedElapsedRef.current = elapsed;
    setRunning(false);
  };

  const handleReset = () => {
    setRunning(false);
    setElapsed(0);
    startTimestampRef.current = 0;
    pausedElapsedRef.current = 0;
    if (sessionId) clearSessionTimer();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
      <Text style={{ fontSize: 20, fontFamily: 'monospace', fontWeight: '600', color: colors.accent.primary }}>
        {formatTime(elapsed)}
      </Text>

      <View style={{ flexDirection: 'row', gap: spacing.sm + spacing.xs, alignItems: 'center' }}>
        {!running ? (
          <TouchableOpacity onPress={handleStart} hitSlop={{ top: spacing.sm, bottom: spacing.sm, left: spacing.sm, right: spacing.sm }}>
            <Text style={{ color: colors.accent.primary, fontWeight: '600', fontSize: 13 }}>Start</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleStop} hitSlop={{ top: spacing.sm, bottom: spacing.sm, left: spacing.sm, right: spacing.sm }}>
            <Text style={{ color: colors.text.secondary, fontWeight: '600', fontSize: 13 }}>Pause</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleReset} hitSlop={{ top: spacing.sm, bottom: spacing.sm, left: spacing.sm, right: spacing.sm }}>
          <Text style={{ color: colors.text.muted, fontWeight: '600', fontSize: 13 }}>Reset</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
