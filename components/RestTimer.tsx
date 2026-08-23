import { View, Text, TouchableOpacity, AppState, Platform, type AppStateStatus } from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { colors, spacing, borderRadius, fonts } from '../lib/theme/tokens';
import {
  saveRestTimer,
  loadRestTimer,
  clearRestTimer,
  calculateRestRemaining,
  type RestTimerState,
} from '../lib/utils/timer-persistence';
import { getCachedSettings } from '../lib/utils/settings';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: getCachedSettings().soundEnabled,
    shouldSetBadge: false,
  }),
});

interface RestTimerProps {
  sessionId?: string;
  duration: number; // seconds
  autoStart?: boolean;
  /** When false the component stays mounted but renders nothing. */
  visible?: boolean;
  /** Increment to force a clean restart with the current duration. */
  restartKey?: number;
  /** Called when a live persisted timer is restored (parent should show the timer). */
  onRestored?: () => void;
  onComplete?: () => void;
  onSkip?: () => void;
  onDurationChange?: (seconds: number) => void;
}

function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const PRESET_OPTIONS = [30, 60, 90, 120, 180];

// Android 8.0+ requires all notifications to belong to a channel; without an
// explicit channel with sound, Android falls back to a silent "Miscellaneous"
// channel. Create one channel for rest-timer alerts and always target it.
const REST_CHANNEL_ID = 'rest-timer';

async function ensureRestChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(REST_CHANNEL_ID, {
      name: 'Descansos',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  } catch {
    // Channel creation is best-effort; scheduling still proceeds on the fallback channel.
  }
}

async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  return finalStatus === 'granted';
}

export function RestTimer({
  sessionId,
  duration,
  autoStart = false,
  visible = true,
  restartKey = 0,
  onRestored,
  onComplete,
  onSkip,
  onDurationChange,
}: RestTimerProps) {
  const [remaining, setRemaining] = useState(duration);
  const [active, setActive] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(duration);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimestampRef = useRef<number>(0);
  const onCompleteRef = useRef(onComplete);
  const onRestoredRef = useRef(onRestored);
  const hasAutoStarted = useRef(false);
  const notificationIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef(sessionId);
  const lastRestartKeyRef = useRef<number | null>(null);

  // Keep refs fresh
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onRestoredRef.current = onRestored;
  }, [onRestored]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Schedule notification when timer starts
  const scheduleNotification = useCallback(async (endTs: number, label: string) => {
    // Android 13+ shows the permission prompt only after a channel exists, so
    // create the channel before requesting permission.
    await ensureRestChannel();

    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return;

    // Cancel any existing notification
    if (notificationIdRef.current) {
      await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
    }

    const secondsUntilEnd = Math.max(1, Math.floor((endTs - Date.now()) / 1000));

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Descanso terminado',
        body: `¡Hora de continuar con ${label}!`,
        sound: getCachedSettings().soundEnabled,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntilEnd,
        channelId: REST_CHANNEL_ID,
      },
    });

    notificationIdRef.current = id;
  }, []);

  // Cancel notification
  const cancelNotification = useCallback(async () => {
    if (notificationIdRef.current) {
      await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
      notificationIdRef.current = null;
    }
  }, []);

  // Clean restart whenever the parent completes another set (restartKey bump).
  // Stays mounted; state survives, so there is no race with AsyncStorage cleanup.
  useEffect(() => {
    if (!visible || !autoStart) return;
    if (lastRestartKeyRef.current === restartKey) return;
    lastRestartKeyRef.current = restartKey;

    // Cancel any pending notification from a previous run, then start fresh.
    cancelNotification();
    const endTs = Date.now() + duration * 1000;
    endTimestampRef.current = endTs;
    setRemaining(duration);
    setSelectedDuration(duration);
    setActive(true);
    if (sessionId) {
      saveRestTimer({
        sessionId,
        endTimestamp: endTs,
        totalDuration: duration,
        isRunning: true,
      });
    }
    scheduleNotification(endTs, 'tu siguiente serie');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey, visible]);

  // AppState listener — recalculate when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && active && endTimestampRef.current > 0) {
        const now = Date.now();
        const remainingSec = Math.ceil((endTimestampRef.current - now) / 1000);

        if (remainingSec <= 0) {
          // Timer completed while in background — let the scheduled notification fire.
          setRemaining(0);
          setActive(false);
          if (sessionIdRef.current) clearRestTimer();
          onCompleteRef.current?.();
        } else {
          setRemaining(remainingSec);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [active]);

  // Restore a persisted live timer on mount (e.g. app was closed mid-rest).
  // Fresh starts are driven by restartKey + autoStart, not by this effect.
  useEffect(() => {
    if (!sessionId) return;

    loadRestTimer(sessionId).then((saved) => {
      if (!saved || !saved.isRunning) return;

      const remainingSec = calculateRestRemaining(saved);
      endTimestampRef.current = saved.endTimestamp;

      if (remainingSec <= 0) {
        // Timer completed while away
        setActive(false);
        setRemaining(0);
        if (sessionId) clearRestTimer();
        onCompleteRef.current?.();
      } else {
        setRemaining(remainingSec);
        setActive(true);
        setSelectedDuration(saved.totalDuration || duration);
        // Mark this restartKey as handled so the restart effect does not
        // overwrite a restored live timer.
        lastRestartKeyRef.current = restartKey;
        onRestoredRef.current?.();
      }
    });
  }, [sessionId, duration]);

  // Countdown interval
  useEffect(() => {
    if (active && remaining > 0) {
      intervalRef.current = setInterval(() => {
        if (endTimestampRef.current > 0) {
          const now = Date.now();
          const remainingSec = Math.ceil((endTimestampRef.current - now) / 1000);

          if (remainingSec <= 0) {
            // Timer completed — let the scheduled notification fire instead of
            // cancelling it (cancelling races the OS delivery and silences it).
            setRemaining(0);
            setActive(false);
            if (sessionIdRef.current) clearRestTimer();
            onCompleteRef.current?.();
          } else {
            setRemaining(remainingSec);
          }
        }
      }, 500); // Check more frequently for accuracy
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active]);

  const handleStart = (dur?: number) => {
    const finalDur = dur ?? selectedDuration;
    const endTs = Date.now() + finalDur * 1000;
    endTimestampRef.current = endTs;

    if (dur) {
      setSelectedDuration(dur);
      onDurationChange?.(dur);
    }

    setRemaining(finalDur);
    setActive(true);

    // Persist
    if (sessionId) {
      saveRestTimer({
        sessionId,
        endTimestamp: endTs,
        totalDuration: finalDur,
        isRunning: true,
      });
    }

    // Schedule notification
    scheduleNotification(endTs, 'tu siguiente serie');
  };

  const handleSkip = async () => {
    setActive(false);
    setRemaining(0);
    endTimestampRef.current = 0;
    await cancelNotification();
    if (sessionId) clearRestTimer();
    onSkip?.();
  };

  const handleAdjust = (delta: number) => {
    const newRemaining = Math.max(0, remaining + delta);
    const newEndTs = Date.now() + newRemaining * 1000;
    endTimestampRef.current = newEndTs;

    if (newRemaining === 0) {
      setActive(false);
      cancelNotification();
      if (sessionIdRef.current) clearRestTimer();
      onCompleteRef.current?.();
    } else {
      setRemaining(newRemaining);
      // Reschedule notification
      scheduleNotification(newEndTs, 'tu siguiente serie');
    }

    // Persist
    if (sessionId && newRemaining > 0) {
      saveRestTimer({
        sessionId,
        endTimestamp: newEndTs,
        totalDuration: selectedDuration,
        isRunning: true,
      });
    }
  };

  const handleSelectDuration = (dur: number) => {
    setSelectedDuration(dur);
    setRemaining(dur);
    setActive(false);
    onDurationChange?.(dur);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Hidden but mounted — parent controls visibility; state survives.
  if (!visible) return null;

  // Duration selector mode (not active, not counting down)
  if (!active && remaining === 0) {
    return (
      <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.sm, padding: spacing.sm + spacing.xs, borderWidth: 1, borderColor: colors.border.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text.secondary }}>DESCANSO</Text>
          {PRESET_OPTIONS.map((dur) => (
            <TouchableOpacity
              key={dur}
              onPress={() => handleSelectDuration(dur)}
              style={{ backgroundColor: selectedDuration === dur ? colors.accent.primary : colors.bg.elevated, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: selectedDuration === dur ? 0 : 1, borderColor: colors.border.primary }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: selectedDuration === dur ? colors.bg.primary : colors.text.secondary }}>
                {dur >= 60 ? `${dur / 60}m` : `${dur}s`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          onPress={() => handleStart()}
          style={{ backgroundColor: colors.accent.primary, borderRadius: borderRadius.sm, paddingVertical: spacing.sm, alignItems: 'center' }}
        >
          <Text style={{ color: colors.bg.primary, fontWeight: '700', fontSize: 12 }}>Descansar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Active countdown — compact single-row bar
  return (
    <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm + spacing.xs, borderWidth: 1, borderColor: colors.accent.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <TouchableOpacity
        onPress={() => handleAdjust(-15)}
        style={{ backgroundColor: colors.border.primary, borderRadius: borderRadius.sm, width: 32, height: 32, justifyContent: 'center', alignItems: 'center' }}
      >
        <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 13 }}>-15</Text>
      </TouchableOpacity>
      <View style={{ alignItems: 'center', flex: 1 }}>
        <Text style={{ fontSize: 9, fontWeight: '600', color: colors.accent.primary, marginBottom: 1 }}>DESCANSO</Text>
        <Text style={{ fontSize: 22, fontFamily: fonts.display, fontWeight: '700', color: colors.accent.primary }}>
          {formatCountdown(remaining)}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <TouchableOpacity
          onPress={() => handleAdjust(15)}
          style={{ backgroundColor: colors.border.primary, borderRadius: borderRadius.sm, width: 32, height: 32, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 13 }}>+15</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleSkip}
          style={{ backgroundColor: colors.border.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, height: 32, justifyContent: 'center', borderWidth: 1, borderColor: colors.border.light }}
        >
          <Text style={{ color: colors.text.secondary, fontWeight: '600', fontSize: 11 }}>Saltar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
