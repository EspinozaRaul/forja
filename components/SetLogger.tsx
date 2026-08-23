import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useRef } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fonts } from '../lib/theme/tokens';
import type { Set, SetMethod } from '../lib/types';
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
  maxWeight?: number | null;
}

export function SetLogger({ set, onUpdate, onDelete, unit = 'kg', onOpenIntensityPicker, isDropGroup, dropCount, previousWeight = null, previousReps = null, previousRir = null, maxWeight = null }: SetLoggerProps) {
  const [reps, setReps] = useState(set.reps?.toString() ?? '');
  const [weight, setWeight] = useState(set.weight?.toString() ?? '');
  const swipeableRef = useRef<Swipeable>(null);

  const isDropSet = set.method === 'dropset';
  const isLinear = set.method === 'linear' || set.method === null;

  const weightPlaceholder = () => {
    if (previousWeight == null) return '0';
    return String(previousWeight);
  };

  const repsPlaceholder = () => (previousReps != null ? String(previousReps) : '0');

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
      <TouchableOpacity onPress={handleDelete} style={styles.deleteAction}>
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  // Format previous data: "10kg x 15"
  const previousText = () => {
    if (previousWeight == null && previousReps == null) return '—';
    const w = previousWeight != null ? `${previousWeight}${unit}` : '?';
    const r = previousReps != null ? previousReps : '?';
    return `${w} x ${r}`;
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <View>
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
            />
          </View>

          {/* Intensity method button */}
          {isLinear && onOpenIntensityPicker && (
            <TouchableOpacity
              onPress={onOpenIntensityPicker}
              style={styles.intensityButton}
            >
              <Ionicons name="flash" size={12} color={colors.warning} />
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

        {/* RIR picker - shown below the set row */}
        <RirPicker
          value={set.rir}
          onChange={(rir) => onUpdate({ rir })}
        />
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  serieCell: {
    width: 28,
    alignItems: 'center',
  },
  serieNumber: {
    fontSize: 14,
    fontFamily: fonts.display,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  anteriorCell: {
    width: 70,
    alignItems: 'center',
  },
  anteriorText: {
    fontSize: 11,
    color: colors.text.muted,
    fontFamily: fonts.body,
  },
  inputCell: {
    width: 52,
    backgroundColor: colors.bg.elevated,
    borderRadius: borderRadius.sm,
    marginHorizontal: 2,
    paddingHorizontal: spacing.xs,
    paddingVertical: 5,
    alignItems: 'center',
  },
  repsCell: {
    width: 52,
    backgroundColor: colors.bg.elevated,
    borderRadius: borderRadius.sm,
    marginHorizontal: 2,
    paddingHorizontal: spacing.xs,
    paddingVertical: 5,
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
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButton: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
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
  dropBadge: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 2,
  },
  dropBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.warning,
  },
});
