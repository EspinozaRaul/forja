import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useRef } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fonts } from '../lib/theme/tokens';
import type { Set } from '../lib/types';

interface PartialSetLoggerProps {
  parentSet: Set;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (updates: { reps?: number; weight?: number; completed?: boolean; partialReps?: number }) => void;
  onDelete?: () => void;
  onComplete: () => void;
  onChangeMethod?: () => void;
  unit?: string;
  previousWeight?: number | null;
  previousReps?: number | null;
}

export function PartialSetLogger({
  parentSet,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
  onComplete,
  onChangeMethod,
  unit = 'kg',
  previousWeight = null,
  previousReps = null,
}: PartialSetLoggerProps) {
  const swipeableRef = useRef<Swipeable>(null);

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

  // Previous text for the anteriorCell
  const previousText = () => {
    if (previousWeight == null && previousReps == null) return '';
    const parts: string[] = [];
    if (previousWeight != null) parts.push(`${previousWeight}${unit}`);
    if (previousReps != null) parts.push(`${previousReps}r`);
    return parts.join(' × ');
  };

  // Local state for weight input
  const [weight, setWeight] = useState(parentSet.weight?.toString() ?? '');
  const [reps, setReps] = useState(parentSet.reps?.toString() ?? '');
  const [partialReps, setPartialReps] = useState(parentSet.partialReps?.toString() ?? '');

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

  // Header row: compact summary without inputs
  const renderHeader = () => (
    <View style={styles.container}>
      {/* Set number + method badge */}
      <View style={styles.serieCell}>
        <Text style={styles.serieNumber}>{parentSet.setNumber}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>PS</Text>
        </View>
      </View>

      {/* Summary — previous data */}
      <View style={styles.rowCenter}>
        <Text style={styles.rowSummary}>
          {previousWeight != null ? `${previousWeight}${unit}` : ''}
          {previousReps != null ? ` × ${previousReps}r` : ''}
        </Text>
      </View>

      {/* Intensity method change button */}
      {onChangeMethod && (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onChangeMethod();
          }}
          style={styles.intensityButton}
        >
          <Ionicons name="flash" size={12} color={colors.accent.primary} />
        </TouchableOpacity>
      )}

      {/* Check button */}
      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation();
          onComplete();
        }}
        style={[
          styles.checkButton,
          parentSet.completed ? styles.checkCompleted : styles.checkIncomplete,
        ]}
      >
        {parentSet.completed && (
          <Ionicons name="checkmark" size={14} color={colors.bg.primary} />
        )}
      </TouchableOpacity>
    </View>
  );

  if (!expanded) {
    return (
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2}
      >
        <View style={styles.outerContainer}>
          <TouchableOpacity onPress={onToggle} activeOpacity={0.7}>
            {renderHeader()}
          </TouchableOpacity>
        </View>
      </Swipeable>
    );
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <View style={styles.outerContainer}>
        <TouchableOpacity onPress={onToggle} activeOpacity={0.7}>
          {renderHeader()}
        </TouchableOpacity>

        {/* Expanded: C+P breakdown — indented below the set number */}
        <View style={styles.expandedBlock}>
          <View style={styles.cpRow}>
            <Text style={styles.cpLabel}>C</Text>
            <TextInput
              style={styles.cpInput}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.text.muted}
              value={reps}
              onChangeText={handleRepsChange}
            />
            <Text style={styles.plusSign}>+</Text>
            <Text style={styles.cpLabel}>P</Text>
            <TextInput
              style={styles.cpInput}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.text.muted}
              value={partialReps}
              onChangeText={handlePartialRepsChange}
            />
            <Text style={styles.cpUnit}>{unit}</Text>
          </View>
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
  // --- Columns matching SetLogger exactly ---
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
  anteriorCell: {
    width: 65,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badge: {
    backgroundColor: colors.accent.muted,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.accent.primary,
    letterSpacing: 0.3,
  },
  rowCenter: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  rowSummary: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  anteriorText: {
    fontSize: 11,
    color: colors.text.muted,
    fontFamily: fonts.body,
    flex: 1,
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
  repsCell: {
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
  // --- Expanded C+P breakdown ---
  expandedBlock: {
    marginTop: spacing.xs,
    paddingLeft: 28 + spacing.xs,
  },
  cpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cpLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.muted,
    width: 14,
  },
  cpInput: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    fontSize: 14,
    fontFamily: fonts.display,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  plusSign: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.muted,
  },
  cpUnit: {
    fontSize: 11,
    color: colors.text.muted,
    fontWeight: '600',
  },
  // --- Swipeable delete ---
  deleteAction: {
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  deleteText: {
    color: colors.text.primary,
    fontWeight: '600',
    fontSize: 13,
  },
});
