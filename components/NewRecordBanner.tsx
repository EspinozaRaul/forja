import { useCallback, useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, fonts, shadows } from '../lib/theme/tokens';

const RECORD_TEXT = '¡Nuevo récord!';
const DISPLAY_MS = 2500;
const FADE_IN_MS = 200;
const FADE_OUT_MS = 250;
const SLIDE_PX = 16;

interface NewRecordBannerProps {
  exerciseName: string;
  weight: number;
  unit: string;
  onDismiss: () => void;
}

export function NewRecordBanner({ exerciseName, weight, unit, onDismiss }: NewRecordBannerProps) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-SLIDE_PX)).current;
  const dismissedRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_OUT_MS,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -SLIDE_PX,
        duration: FADE_OUT_MS,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        onDismissRef.current();
      }
    });
  }, [opacity, translateY]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: FADE_IN_MS, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: FADE_IN_MS, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(dismiss, DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [opacity, translateY, dismiss]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: insets.top + spacing.sm,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 1000,
        elevation: 10,
      }}
    >
      <Animated.View
        style={{
          opacity,
          transform: [{ translateY }],
          backgroundColor: colors.warning,
          borderRadius: borderRadius.full,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          maxWidth: '90%',
          ...shadows.card,
        }}
      >
        <Text
          numberOfLines={1}
          style={{ color: colors.bg.primary, fontSize: 12, fontWeight: '700', fontFamily: fonts.bodyMedium }}
        >
          {RECORD_TEXT} {exerciseName} · {weight} {unit}
        </Text>
      </Animated.View>
    </View>
  );
}