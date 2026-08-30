import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts } from '../lib/theme/tokens';
import type { Set } from '../lib/types';

interface Drop {
  id?: number;
  weight: number | null;
  reps: number | null;
  completed: boolean;
  rir?: number | null;
}

interface DropSetLoggerProps {
  parentSet: Set;
  drops: Drop[];
  method?: string;
  expanded: boolean;
  onToggle: () => void;
  onUpdateDrop: (dropIndex: number, updates: { reps?: number; weight?: number }) => void;
  onAddDrop: () => void;
  onDeleteDrop: (dropIndex: number) => void;
  onDelete?: () => void;
  onCompleteAll: () => void;
  onUncompleteAll?: () => void;
  onChangeMethod?: () => void;
  unit?: string;
  onUnitChange?: (unit: string) => void;
  previousWeight?: number | null;
  previousReps?: number | null;
  previousDropFor?: (method: string, dropOrder: number) => { weight: number | null; reps: number | null } | undefined;
  maxWeight?: number | null;
}

export function DropSetLogger({
  parentSet,
  drops,
  method = 'dropset',
  expanded,
  onToggle,
  onUpdateDrop,
  onAddDrop,
  onDeleteDrop,
  onDelete,
  onCompleteAll,
  onUncompleteAll,
  onChangeMethod,
  unit = 'kg',
  onUnitChange,
  previousWeight = null,
  previousReps = null,
  previousDropFor,
  maxWeight = null,
}: DropSetLoggerProps) {
  const allCompleted = drops.length > 0 && drops.every((d) => d.completed);
  const swipeableRef = useRef<Swipeable>(null);
  const { t } = useTranslation();

  const badgeText = method === 'dropset' ? 'DS' : method === 'rest_pause' ? 'RP' : method === 'cluster' ? 'CL' : method === 'partial' ? 'PS' : 'DS';
  const segmentCount = drops.length;
  const unitLabel = t(`methods.${method}.unitLabel`);
  const unitLabelPlural = t(`methods.${method}.unitLabelPlural`);

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

  // Header row: compact summary without inputs
  // Check button is OUTSIDE the toggle TouchableOpacity to avoid conflict
  const renderHeader = () => (
    <View style={styles.container}>
      {/* Toggle area — only set number + summary */}
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={styles.toggleArea}>
        <View style={styles.serieCell}>
          <Text style={styles.serieNumber}>{parentSet.setNumber}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        </View>
        <View style={styles.rowCenter}>
          <Text style={styles.rowSummary}>
            {segmentCount} {unitLabelPlural}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Intensity method change button */}
      {onChangeMethod && (
        <TouchableOpacity
          onPress={onChangeMethod}
          style={styles.intensityButton}
        >
          <Ionicons name="flash" size={12} color={colors.accent.primary} />
        </TouchableOpacity>
      )}

      {/* Check button — toggle: complete all / uncomplete all */}
      <TouchableOpacity
        onPress={() => allCompleted ? onUncompleteAll?.() : onCompleteAll()}
        style={[
          styles.checkButton,
          allCompleted ? styles.checkCompleted : styles.checkIncomplete,
        ]}
      >
        {allCompleted && (
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
          {renderHeader()}
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
        {renderHeader()}

        {/* Drops — each is a proper React component */}
        <View style={styles.dropsBlock}>
          {drops.map((drop, index) => (
            <DropRow
              key={drop.id ?? index}
              index={index}
              drop={drop}
              unit={unit}
              method={method}
              showDelete={drops.length > 1}
              showLine={index < drops.length - 1}
              onUpdateDrop={onUpdateDrop}
              onDeleteDrop={onDeleteDrop}
              previousWeight={previousWeight}
              previousReps={previousReps}
              previousDropFor={previousDropFor}
              maxWeight={maxWeight}
            />
          ))}

          {/* Add drop */}
          <TouchableOpacity onPress={onAddDrop} style={styles.addDropButton}>
            <Text style={{ fontSize: 13, color: colors.accent.secondary }}>+</Text>
            <Text style={styles.addDropText}>{t('session.dropSet.addUnit', { unit: unitLabel })}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Swipeable>
  );
}

// Separate component — hooks are safe here, one component = stable hook count
function DropRow({
  index,
  drop,
  unit,
  method,
  showDelete,
  showLine,
  onUpdateDrop,
  onDeleteDrop,
  previousWeight = null,
  previousReps = null,
  previousDropFor,
  maxWeight = null,
}: {
  index: number;
  drop: Drop;
  unit: string;
  method: string;
  showDelete: boolean;
  showLine: boolean;
  onUpdateDrop: (dropIndex: number, updates: { reps?: number; weight?: number }) => void;
  onDeleteDrop: (dropIndex: number) => void;
  previousWeight?: number | null;
  previousReps?: number | null;
  previousDropFor?: (method: string, dropOrder: number) => { weight: number | null; reps: number | null } | undefined;
  maxWeight?: number | null;
}) {
  const [reps, setReps] = useState(drop.reps?.toString() ?? '');
  const [weight, setWeight] = useState(drop.weight?.toString() ?? '');

  // Sync local state when props change (e.g., undo, server sync)
  useEffect(() => { setReps(drop.reps?.toString() ?? ''); }, [drop.reps]);
  useEffect(() => { setWeight(drop.weight?.toString() ?? ''); }, [drop.weight]);

  // Per-drop previous data from any past session
  const prevDrop = previousDropFor?.(method, index + 1);

  const handleRepsChange = (text: string) => {
    setReps(text);
    const value = parseInt(text, 10);
    onUpdateDrop(index, { reps: isNaN(value) || value < 0 ? undefined : value });
  };

  const handleWeightChange = (text: string) => {
    setWeight(text);
    const value = parseFloat(text);
    onUpdateDrop(index, { weight: isNaN(value) || value < 0 ? undefined : value });
  };

  const weightPlaceholder = () => {
    // Per-drop previous first, then parent fallback
    const pw = prevDrop?.weight ?? previousWeight;
    if (pw == null) return unit;
    if (maxWeight != null) {
      return pw >= maxWeight ? `${pw} ▲` : `${pw} ▼`;
    }
    return String(pw);
  };

  const repsPlaceholder = () => {
    const pr = prevDrop?.reps ?? previousReps;
    return pr != null ? String(pr) : 'Reps';
  };

  // Label: show previous data if available, otherwise "Drop N"
  const labelText = prevDrop
    ? `${prevDrop.weight ?? '?'}${unit} × ${prevDrop.reps ?? '?'}r`
    : `Drop ${index + 1}`;

  return (
    <View style={styles.dropRow}>
      <View style={styles.dropIndicator}>
        <View style={[styles.dropDot, drop.completed && styles.dropDotCompleted]} />
        {showLine && <View style={styles.dropLine} />}
      </View>

      {/* Drop label — previous data or fallback */}
      <View style={styles.dropLabelCell}>
        <Text style={styles.dropLabelText}>{labelText}</Text>
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

      {/* Spacer for alignment with header's check column */}
      <View style={styles.intensityButton} />

      {/* Delete button */}
      {showDelete ? (
        <TouchableOpacity
          onPress={() => onDeleteDrop(index)}
          style={styles.checkButton}
        >
          <Text style={{ fontSize: 14, color: colors.error }}>×</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.checkButton} />
      )}
    </View>
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
  toggleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // --- Columns matching SetLogger exactly ---
  serieCell: {
    width: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  serieNumber: {
    fontSize: 14,
    fontFamily: fonts.display,
    fontWeight: '600',
    color: colors.text.secondary,
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
  // --- Expanded drops ---
  dropsBlock: {
    marginTop: spacing.xs,
    paddingLeft: 28 + spacing.xs,
  },
  dropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dropIndicator: {
    width: 12,
    alignItems: 'center',
  },
  dropDot: {
    width: 6,
    height: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.border.light,
    marginTop: 6,
  },
  dropDotCompleted: {
    backgroundColor: colors.accent.primary,
  },
  dropLine: {
    width: 1,
    flex: 1,
    backgroundColor: colors.border.primary,
    marginTop: 4,
  },
  dropLabelCell: {
    width: 65,
    alignItems: 'flex-start',
    paddingLeft: spacing.xs,
  },
  dropLabelText: {
    fontSize: 11,
    color: colors.text.muted,
    fontFamily: fonts.body,
  },
  // --- Add drop ---
  addDropButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  addDropText: {
    fontSize: 13,
    color: colors.accent.secondary,
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
