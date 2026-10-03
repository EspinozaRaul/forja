import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts, fontSizes , fontWeights, borderWidths} from '../lib/theme/tokens';
import { SET_LOGGER } from '../lib/constants/layout';
import type { Set } from '../lib/types';
import { RirPicker } from './RirPicker';

interface SetLoggerProps {
  set: Set;
  onUpdate: (updates: { reps?: number; weight?: number; completed?: boolean; rir?: number | null }) => void;
  onDelete?: () => void;
  unit?: string;
  onOpenIntensityPicker?: () => void;
  isDropGroup?: boolean;
  previousWeight?: number | null;
  previousReps?: number | null;
  previousMethod?: string | null;
  /**
   * Accepted but not consumed. Six call sites pass these (`SessionExerciseItem`,
   * `SupersetComponents`) and the row ignores them — pre-existing dead props, left in the
   * type so the call sites keep type-checking. The destructuring below deliberately omits
   * them: `no-unused-vars` is right that a parameter nobody reads is either a bug or
   * noise. Removing them properly means touching every call site, which is its own unit.
   */
  previousRir?: number | null;
  maxWeight?: number | null;
  /**
   * Only one row's delete action may be open at a time. While it is open it sits over the
   * row and covers the intensity control, which is how the owner lost track of a control he
   * still had. The parent owns which row is open; see unit 3 of
   * odd/tasks/session-data-integrity.md.
   */
  isSwipeOpen?: boolean;
  onSwipeOpen?: () => void;
  onSwipeClose?: () => void;
}

export function SetLogger({ set, onUpdate, onDelete, unit = 'kg', onOpenIntensityPicker, isDropGroup, previousWeight = null, previousReps = null, previousMethod = null, isSwipeOpen = false, onSwipeOpen, onSwipeClose }: SetLoggerProps) {
  const [reps, setReps] = useState(set.reps?.toString() ?? '');
  const [weight, setWeight] = useState(set.weight?.toString() ?? '');
  const swipeableRef = useRef<Swipeable>(null);
  const { t } = useTranslation();

  // Another row opened its action: close this one. The parent flips `isSwipeOpen` to false
  // for every row except the open one, so this is the whole coordination.
  useEffect(() => {
    if (!isSwipeOpen) swipeableRef.current?.close();
  }, [isSwipeOpen]);

  // Sync local state when props change (e.g., undo, server sync)
  useEffect(() => { setReps(set.reps?.toString() ?? ''); }, [set.reps]);
  useEffect(() => { setWeight(set.weight?.toString() ?? ''); }, [set.weight]);

  const isDropSet = set.method === 'dropset';

  const weightPlaceholder = () => {
    if (previousWeight == null) return unit.toUpperCase();
    return `${previousWeight} ${unit.toUpperCase()}`;
  };

  const repsPlaceholder = () => (previousReps != null ? String(previousReps) : 'R');

  const handleRepsChange = (text: string) => {
    setReps(text);
    const value = parseInt(text, 10);
    if (isNaN(value) || value <= 0) {
      onUpdate({ reps: undefined });
    } else {
      onUpdate({ reps: value });
    }
  };

  const handleWeightChange = (text: string) => {
    setWeight(text);
    const value = parseFloat(text);
    if (isNaN(value) || value <= 0) {
      onUpdate({ weight: undefined });
    } else {
      onUpdate({ weight: value });
    }
  };

  const handleDelete = () => {
    swipeableRef.current?.close();
    onDelete?.();
  };

  const renderRightActions = () => {
    if (!onDelete) return null;
    return (
      <TouchableOpacity
        onPress={handleDelete}
        style={styles.deleteAction}
        accessibilityLabel={t('accessibility.setLogger.deleteSet')}
        accessibilityRole="button"
        accessibilityHint={t('accessibility.setLogger.deleteHint')}
      >
        <Text style={styles.deleteText}>{t('session.swipe.delete')}</Text>
      </TouchableOpacity>
    );
  };

  // Format previous data: "10KG x 15" or "10KG x 15 [CL]" for intensity methods
  const previousText = () => {
    if (previousWeight == null && previousReps == null) return '—';
    const w = previousWeight != null ? `${previousWeight}${unit.toUpperCase()}` : '?';
    const r = previousReps != null ? previousReps : '?';
    const base = `${w} x ${r}`;
    // Show intensity method label if it's not linear
    if (previousMethod && previousMethod !== 'linear' && previousMethod !== 'partial') {
      const methodLabels: Record<string, string> = {
        dropset: 'DS',
        rest_pause: 'RP',
        cluster: 'CL',
        pyramid_up: '↑',
        pyramid_down: '↓',
        superset: 'SS',
      };
      const label = methodLabels[previousMethod] ?? previousMethod;
      return `${base} [${label}]`;
    }
    return base;
  };

  return (
    <Swipeable
      ref={swipeableRef}
      onSwipeableOpen={() => onSwipeOpen?.()}
      onSwipeableClose={() => onSwipeClose?.()}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <View style={styles.outerContainer}>
        <View style={styles.container}>
          {/* Set number */}
          <View style={styles.serieCell}>
            <Text style={styles.serieNumber}>{set.setNumber}</Text>
            {isDropSet && isDropGroup && (
              <View style={styles.dropBadge}>
                <Text style={styles.dropBadgeText}>DS</Text>
              </View>
            )}
          </View>

          {/* Previous data */}
          <View style={styles.anteriorCell}>
            <Text style={styles.anteriorText} numberOfLines={1}>
              {previousText()}
            </Text>
          </View>

          {/* Weight input */}
          <View style={styles.inputCell}>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder={weightPlaceholder()}
              placeholderTextColor={colors.text.muted}
              value={weight}
              onChangeText={handleWeightChange}
              accessibilityLabel={t('accessibility.setLogger.weight')}
              accessibilityHint={t('accessibility.setLogger.weightHint')}
            />
          </View>

          {/* Reps input */}
          <View style={styles.repsCell}>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder={repsPlaceholder()}
              placeholderTextColor={colors.text.muted}
              value={reps}
              onChangeText={handleRepsChange}
              accessibilityLabel={t('accessibility.setLogger.reps')}
              accessibilityHint={t('accessibility.setLogger.repsHint')}
            />
          </View>

          {/* Intensity method button — always available when a handler exists. It is how a
              method is CHOSEN; gating it on the current method is what turned `superset` and the
              pyramid values into a one-way door, because a set holding one of them fell into this
              branch with `isLinear` false and lost the only control that could change it.
              See odd/tasks/intensity-method-lockout.md. */}
          {onOpenIntensityPicker && (
            <TouchableOpacity
              onPress={onOpenIntensityPicker}
              style={styles.intensityButton}
              accessibilityLabel={t('accessibility.setLogger.intensityMethod')}
              accessibilityRole="button"
              accessibilityHint={t('accessibility.setLogger.intensityHint')}
            >
              <Ionicons name="flash" size={12} color={colors.text.muted} />
            </TouchableOpacity>
          )}

          {/* Check button */}
          <TouchableOpacity
            onPress={() => {
              // Bug #3 fix: when completing a set without explicit values, copy previous values
              if (!set.completed && weight === '' && reps === '' && (previousWeight != null || previousReps != null)) {
                if (previousWeight != null) {
                  setWeight(String(previousWeight));
                  onUpdate({ completed: true, weight: previousWeight, reps: previousReps ?? undefined });
                  return;
                }
              }
              onUpdate({ completed: !set.completed });
            }}
            hitSlop={{ top: 8, bottom: 8, right: 8, left: 0 }}
            style={[
              styles.checkButton,
              set.completed ? styles.checkCompleted : styles.checkIncomplete,
            ]}
            accessibilityLabel={set.completed ? t('accessibility.setActions.markIncomplete') : t('accessibility.setActions.markComplete')}
            accessibilityRole="button"
            accessibilityState={{ checked: set.completed }}
          >
            {set.completed && (
              <Ionicons name="checkmark" size={14} color={colors.text.onAccent} />
            )}
          </TouchableOpacity>
        </View>

        {/* RIR picker - shown below the set row */}
        <RirPicker
          value={set.rir}
          onChange={(rir) => onUpdate({ rir })}
          endPadding={onOpenIntensityPicker ? 56 : 32}
        />
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    paddingHorizontal: spacing.sm,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  serieCell: {
    width: SET_LOGGER.SERIE_WIDTH,
    alignItems: 'center',
  },
  serieNumber: {
    fontSize: fontSizes.sm, fontFamily: fonts.display,
    fontWeight: fontWeights.semibold,
    color: colors.text.secondary,
  },
  anteriorCell: {
    width: SET_LOGGER.PREVIOUS_WIDTH,
    alignItems: 'center',
  },
  anteriorText: {
    fontSize: fontSizes.xs, color: colors.text.muted,
    fontFamily: fonts.body,
  },
  inputCell: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: borderRadius.sm,
    marginHorizontal: spacing.xxs,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  repsCell: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: borderRadius.sm,
    marginHorizontal: spacing.xxs,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  input: {
    fontSize: fontSizes.sm, fontFamily: fonts.display,
    fontWeight: fontWeights.semibold,
    color: colors.text.primary,
    textAlign: 'center',
    textAlignVertical: 'center',
    width: '100%',
  },
  intensityButton: {
    width: SET_LOGGER.INTENSITY_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButton: {
    width: SET_LOGGER.CHECK_SIZE,
    height: SET_LOGGER.CHECK_SIZE,
    borderRadius: borderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  checkCompleted: {
    backgroundColor: colors.accent.primary,
  },
  checkIncomplete: {
    backgroundColor: 'transparent',
    borderWidth: borderWidths.medium,
    borderColor: colors.border.primary,
  },
  deleteAction: {
    backgroundColor: colors.errorStrong,
    justifyContent: 'center',
    alignItems: 'center',
    width: SET_LOGGER.DELETE_WIDTH,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  deleteText: {
    color: colors.text.onAccent,
    fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.bold,
    fontSize: fontSizes.sm
  },
  dropBadge: {
    backgroundColor: colors.statusMuted.warning,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.xs,
    marginTop: spacing.xxs,
  },
  dropBadgeText: {
    fontSize: fontSizes.xxs, fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.extrabold,
    color: colors.warning,
  },
});
