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
  dropCount?: number;
  previousWeight?: number | null;
  previousReps?: number | null;
  previousRir?: number | null;
  previousMethod?: string | null;
  maxWeight?: number | null;
}

export function SetLogger({ set, onUpdate, onDelete, unit = 'kg', onOpenIntensityPicker, isDropGroup, dropCount, previousWeight = null, previousReps = null, previousRir = null, previousMethod = null, maxWeight = null }: SetLoggerProps) {
  const [reps, setReps] = useState(set.reps?.toString() ?? '');
  const [weight, setWeight] = useState(set.weight?.toString() ?? '');
  const swipeableRef = useRef<Swipeable>(null);
  const { t } = useTranslation();

  // Sync local state when props change (e.g., undo, server sync)
  useEffect(() => { setReps(set.reps?.toString() ?? ''); }, [set.reps]);
  useEffect(() => { setWeight(set.weight?.toString() ?? ''); }, [set.weight]);

  const isDropSet = set.method === 'dropset';
  const isLinear = set.method === 'linear' || set.method === null || set.method === 'partial';

  const weightPlaceholder = () => {
    if (previousWeight == null) return unit.toUpperCase();
    return `${previousWeight} ${unit.toUpperCase()}`;
  };

  const repsPlaceholder = () => (previousReps != null ? String(previousReps) : 'R');

  const handleRepsChange = (text: string) => {
    setReps(text);
    const value = parseInt(text, 10);
    if (isNaN(value) || value < 0) {
      onUpdate({ reps: undefined });
    } else {
      onUpdate({ reps: value });
    }
  };

  const handleWeightChange = (text: string) => {
    setWeight(text);
    const value = parseFloat(text);
    if (isNaN(value) || value < 0) {
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
        accessibilityLabel="Eliminar serie"
        accessibilityRole="button"
        accessibilityHint="Elimina esta serie del ejercicio"
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
              accessibilityLabel="Peso de la serie"
              accessibilityHint="Ingresa el peso en kilogramos"
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
              accessibilityLabel="Repeticiones de la serie"
              accessibilityHint="Ingresa el número de repeticiones"
            />
          </View>

          {/* Intensity method button */}
          {isLinear && onOpenIntensityPicker && (
            <TouchableOpacity
              onPress={onOpenIntensityPicker}
              style={styles.intensityButton}
              accessibilityLabel="Cambiar método de intensidad"
              accessibilityRole="button"
              accessibilityHint="Abre el selector de método de intensidad"
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
            style={[
              styles.checkButton,
              set.completed ? styles.checkCompleted : styles.checkIncomplete,
            ]}
            accessibilityLabel={set.completed ? "Marcar serie como incompleta" : "Marcar serie como completada"}
            accessibilityRole="button"
          >
            {set.completed && (
              <Ionicons name="checkmark" size={14} color={colors.bg.primary} />
            )}
          </TouchableOpacity>
        </View>

        {/* RIR picker - shown below the set row */}
        <RirPicker
          value={set.rir}
          onChange={(rir) => onUpdate({ rir })}
          endPadding={(isLinear && onOpenIntensityPicker) ? 56 : 32}
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
  dropBadge: {
    backgroundColor: colors.statusMuted.warning,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.xs,
    marginTop: spacing.xxs,
  },
  dropBadgeText: {
    fontSize: fontSizes.xxs, fontWeight: fontWeights.extrabold,
    color: colors.warning,
  },
});
