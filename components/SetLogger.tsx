import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useRef } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { colors, spacing, borderRadius } from '../lib/theme/tokens';
import type { Set, SetMethod } from '../lib/types';
import { RirPicker } from './RirPicker';

interface SetLoggerProps {
  set: Set;
  onUpdate: (updates: { reps?: number; weight?: number; completed?: boolean; rir?: number }) => void;
  onDelete?: () => void;
  unit?: string; // kg or lbs
  onUnitChange?: (unit: string) => void;
  onOpenIntensityPicker?: () => void;
  isDropGroup?: boolean;
  dropCount?: number;
}

export function SetLogger({ set, onUpdate, onDelete, unit = 'kg', onUnitChange, onOpenIntensityPicker, isDropGroup, dropCount }: SetLoggerProps) {
  const [reps, setReps] = useState(set.reps?.toString() ?? '');
  const [weight, setWeight] = useState(set.weight?.toString() ?? '');
  const swipeableRef = useRef<Swipeable>(null);

  const isDropSet = set.method === 'dropset';
  const isLinear = set.method === 'linear' || set.method === null;

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
      >
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    );
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
          {/* Set number with method badge */}
          <View style={styles.setInfo}>
            <Text style={styles.setNumber}>
              #{set.setNumber}
            </Text>
            {isDropSet && isDropGroup && (
              <View style={styles.dropBadge}>
                <Text style={styles.dropBadgeText}>⚡ DROP</Text>
              </View>
            )}
            {isDropSet && !isDropGroup && (
              <Text style={styles.dropOrderText}>↓{set.dropOrder}</Text>
            )}
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="Reps"
              placeholderTextColor={colors.text.muted}
              value={reps}
              onChangeText={handleRepsChange}
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder={unit}
              placeholderTextColor={colors.text.muted}
              value={weight}
              onChangeText={handleWeightChange}
            />
          </View>
          {onUnitChange && (
            <TouchableOpacity
              onPress={() => onUnitChange(unit === 'kg' ? 'lbs' : 'kg')}
              style={styles.unitToggle}
            >
              <Text style={styles.unitText}>{unit}</Text>
            </TouchableOpacity>
          )}

          {/* Convert to drop set button (only for linear sets) */}
          {isLinear && onOpenIntensityPicker && (
            <TouchableOpacity
              onPress={onOpenIntensityPicker}
              style={styles.convertButton}
            >
              <Text style={{ fontSize: 14, color: colors.warning }}>⚡</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => onUpdate({ completed: !set.completed })}
            style={[
              styles.checkButton,
              set.completed
                ? styles.checkButtonCompleted
                : styles.checkButtonIncomplete,
            ]}
          >
            <Text style={[
              styles.checkText,
              { color: set.completed ? colors.bg.primary : colors.text.secondary }
            ]}>
              {set.completed ? '✓' : ''}
            </Text>
          </TouchableOpacity>
        </View>
        <RirPicker
          value={set.rir}
          onChange={(rir) => onUpdate({ rir: rir ?? undefined })}
        />
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: borderRadius.sm,
    paddingVertical: spacing.xs,
  },
  setNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.muted,
    width: 28,
    textAlign: 'center',
  },
  inputContainer: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  input: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    width: '100%',
  },
  checkButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkButtonCompleted: {
    backgroundColor: colors.accent.primary,
  },
  checkButtonIncomplete: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border.primary,
  },
  checkText: {
    fontSize: 14,
    fontWeight: '700',
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
  unitToggle: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 36,
    alignItems: 'center',
  },
  unitText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.muted,
  },
  setInfo: {
    width: 28,
    alignItems: 'center',
    gap: 2,
  },
  dropBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  dropBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.warning,
  },
  dropOrderText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warning,
  },
  convertButton: {
    padding: 6,
    borderRadius: borderRadius.sm,
  },
});
