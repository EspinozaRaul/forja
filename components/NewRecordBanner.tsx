import { useCallback, useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts, shadows, fontSizes , fontWeights} from '../lib/theme/tokens';
import { ANIMATION_CONFIG } from '../lib/constants/config';

const DISPLAY_MS = ANIMATION_CONFIG.BANNER_DISPLAY;
const FADE_IN_MS = ANIMATION_CONFIG.BANNER_FADE_IN;
const FADE_OUT_MS = ANIMATION_CONFIG.BANNER_FADE_OUT;
const SLIDE_PX = ANIMATION_CONFIG.BANNER_SLIDE;

interface NewRecordBannerProps {
  exerciseName: string;
  weight: number;
  unit: string;
  onDismiss: () => void;
}

export function NewRecordBanner({ exerciseName, weight, unit, onDismiss }: NewRecordBannerProps) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
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
          style={{ color: colors.bg.primary, fontSize: fontSizes.sm, fontWeight: fontWeights.bold, fontFamily: fonts.bodyMedium }}
        >
          {t('session.newRecord')} {exerciseName} · {weight} {unit}
        </Text>
      </Animated.View>
    </View>
  );
}