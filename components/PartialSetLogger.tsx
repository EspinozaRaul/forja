import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fonts } from '../lib/theme/tokens';
import type { Set } from '../lib/types';

interface PartialSetLoggerProps {
  set: Set;
  onUpdate: (updates: { reps?: number; weight?: number; completed?: boolean; partialReps?: number }) => void;
  onDelete?: () => void;
  unit?: string;
  onChangeMethod?: () => void;
  previousWeight?: number | null;
  previousReps?: number | null;
}

export function PartialSetLogger({
  set,
  onUpdate,
  onDelete,
  unit = 'kg',
  onChangeMethod,
  previousWeight = null,
  previousReps = null,
}: PartialSetLoggerProps) {
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
        <Text style={styles.deleteText}>Eliminar</Text>
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

  const weightPlaceholder = previousWeight != null ? String(previousWeight) : `0${unit}`;
  const repsPlaceholder = previousReps != null ? String(previousReps) : '0R';

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <View style={styles.outerContainer}>
        <View style={styles.container}>
          {/* Set number + PS badge */}
          <View style={styles.serieCell}>
            <Text style={styles.serieNumber}>{set.setNumber}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>PS</Text>
            </View>
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
              placeholder="0R/P"
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
            onPress={() => onUpdate({ completed: !set.completed })}
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
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  serieCell: {
    width: 30,
    alignItems: 'center',
  },
  serieNumber: {
    fontSize: 14,
    fontFamily: fonts.display,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  badge: {
    backgroundColor: colors.accent.muted,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.accent.primary,
    letterSpacing: 0.3,
  },
  anteriorCell: {
    width: 65,
    alignItems: 'center',
  },
  anteriorText: {
    fontSize: 11,
    color: colors.text.muted,
    fontFamily: fonts.body,
  },
  inputCell: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: borderRadius.sm,
    marginHorizontal: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    alignItems: 'center',
  },
  input: {
    fontSize: 14,
    fontFamily: fonts.display,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    width: '100%',
  },
  intensityButton: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButton: {
    width: 28,
    height: 28,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
  checkCompleted: {
    backgroundColor: colors.accent.primary,
  },
  checkIncomplete: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border.primary,
  },
  deleteAction: {
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.sm,
  },
  deleteText: {
    color: colors.text.primary,
    fontWeight: '700',
    fontSize: 14,
  },
});
