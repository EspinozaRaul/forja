import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts, fontSizes , fontWeights, borderWidths} from '../lib/theme/tokens';
import { SET_LOGGER } from '../lib/constants/layout';
import type { Set } from '../lib/types';

interface PartialSetLoggerProps {
  set: Set;
  onUpdate: (updates: { reps?: number; weight?: number; completed?: boolean; partialReps?: number }) => void;
  onDelete?: () => void;
  unit?: string;
  onChangeMethod?: () => void;
  previousWeight?: number | null;
  previousReps?: number | null;
  previousPartialReps?: number | null;
  previousMethod?: string | null;
}

export function PartialSetLogger({
  set,
  onUpdate,
  onDelete,
  unit = 'kg',
  onChangeMethod,
  previousWeight = null,
  previousReps = null,
  previousPartialReps = null,
  previousMethod = null,
}: PartialSetLoggerProps) {
  const { t } = useTranslation();
  const swipeableRef = useRef<Swipeable>(null);

  const [weight, setWeight] = useState(set.weight?.toString() ?? '');
  const [reps, setReps] = useState(set.reps?.toString() ?? '');
  const [partialReps, setPartialReps] = useState(set.partialReps?.toString() ?? '');

  // Sync local state when props change
  useEffect(() => { setWeight(set.weight?.toString() ?? ''); }, [set.weight]);
  useEffect(() => { setReps(set.reps?.toString() ?? ''); }, [set.reps]);
  useEffect(() => { setPartialReps(set.partialReps?.toString() ?? ''); }, [set.partialReps]);

  const handleWeightChange = (text: string) => {
    setWeight(text);
    const value = parseFloat(text);
    onUpdate({ weight: isNaN(value) || value < 0 ? undefined : value });
  };

  const handleRepsChange = (text: string) => {
    setReps(text);
    const value = parseInt(text, 10);
    onUpdate({ reps: isNaN(value) || value < 0 ? undefined : value });
  };

  const handlePartialRepsChange = (text: string) => {
    setPartialReps(text);
    const value = parseInt(text, 10);
    onUpdate({ partialReps: isNaN(value) || value < 0 ? undefined : value });
  };

  const handleDelete = () => {
    swipeableRef.current?.close();
    onDelete?.();
  };

  const renderRightActions = () => {
    if (!onDelete) return null;
    return (
      <TouchableOpacity onPress={handleDelete} style={styles.deleteAction}>
        <Text style={styles.deleteText}>{t('session.swipe.delete')}</Text>
      </TouchableOpacity>
    );
  };

  // Previous data text
  const previousText = () => {
    if (previousWeight == null && previousReps == null) return '—';
    const w = previousWeight != null ? `${previousWeight}${unit}` : '?';
    const r = previousReps != null ? previousReps : '?';
    return `${w} × ${r}`;
  };

  const weightPlaceholder = previousWeight != null ? String(previousWeight) : unit;
  const repsPlaceholder = previousReps != null ? String(previousReps) : 'R';

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <View style={styles.outerContainer}>
        {/* Row 1: number + badge */}
        <View style={styles.headerRow}>
          <View style={styles.serieCell}>
            <Text style={styles.serieNumber}>{set.setNumber}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Partial</Text>
          </View>
        </View>

        {/* Row 2: inputs */}
        <View style={styles.container}>
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
              placeholder={weightPlaceholder}
              placeholderTextColor={colors.text.muted}
              value={weight}
              onChangeText={handleWeightChange}
            />
          </View>

          {/* C (contractions) input */}
          <View style={styles.inputCell}>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder={repsPlaceholder}
              placeholderTextColor={colors.text.muted}
              value={reps}
              onChangeText={handleRepsChange}
            />
          </View>

          {/* P (partial reps) input */}
          <View style={styles.inputCell}>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="R/P"
              placeholderTextColor={colors.text.muted}
              value={partialReps}
              onChangeText={handlePartialRepsChange}
            />
          </View>

          {/* Intensity method change button */}
          {onChangeMethod && (
            <TouchableOpacity
              onPress={onChangeMethod}
              style={styles.intensityButton}
            >
              <Ionicons name="flash" size={12} color={colors.accent.primary} />
            </TouchableOpacity>
          )}

          {/* Check button */}
          <TouchableOpacity
            onPress={() => {
              // Bug fix: when completing a set without explicit values, copy ALL previous values including partialReps
              if (!set.completed && weight === '' && reps === '' && partialReps === '' && (previousWeight != null || previousReps != null)) {
                if (previousWeight != null) {
                  setWeight(String(previousWeight));
                  if (previousReps != null) setReps(String(previousReps));
                  if (previousPartialReps != null) setPartialReps(String(previousPartialReps));
                  onUpdate({ completed: true, weight: previousWeight, reps: previousReps ?? undefined, partialReps: previousPartialReps ?? undefined });
                  return;
                }
              }
              onUpdate({ completed: !set.completed });
            }}
            style={[
              styles.checkButton,
              set.completed ? styles.checkCompleted : styles.checkIncomplete,
            ]}
          >
            {set.completed && (
              <Ionicons name="checkmark" size={14} color={colors.bg.primary} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    paddingHorizontal: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xxs,
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
  badge: {
    backgroundColor: colors.accent.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.xs,
  },
  badgeText: {
    fontSize: fontSizes.xxs, fontWeight: fontWeights.extrabold,
    color: colors.accent.primary,
    letterSpacing: 0.3,
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
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: SET_LOGGER.DELETE_WIDTH,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  deleteText: {
    color: colors.text.primary,
    fontWeight: fontWeights.bold,
    fontSize: fontSizes.sm
  },
});
