import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useRef } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { colors, spacing, borderRadius, fonts } from '../lib/theme/tokens';
import type { Set } from '../lib/types';

interface Drop {
  id?: number;
  weight: number | null;
  reps: number | null;
  completed: boolean;
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
  unit?: string;
  onUnitChange?: (unit: string) => void;
  previousWeight?: number | null;
  previousReps?: number | null;
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
  unit = 'kg',
  onUnitChange,
  previousWeight = null,
  previousReps = null,
  maxWeight = null,
}: DropSetLoggerProps) {
  const allCompleted = drops.length > 0 && drops.every((d) => d.completed);
  const swipeableRef = useRef<Swipeable>(null);

  const badgeText = method === 'dropset' ? 'DS' : method === 'rest_pause' ? 'RP' : method === 'cluster' ? 'CL' : 'DS';
  const dropLabel = (index: number) =>
    method === 'dropset' ? `Drop ${index + 1}` : `Segmento ${index + 1}`;
  // Method-aware unit labels so cluster/rest-pause never read as "Drop"
  const unitLabel = method === 'dropset' ? 'Drop' : 'Segmento';
  const unitLabelPlural = method === 'dropset' ? 'drops' : 'segmentos';

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

  if (!expanded) {
    // Collapsed — same row structure as SetLogger
    const firstDrop = drops[0];
    const summaryReps = firstDrop?.reps;
    const summaryWeight = firstDrop?.weight;

    return (
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2}
      >
        <TouchableOpacity onPress={onToggle} activeOpacity={0.7}>
          <View style={styles.row}>
            <View style={styles.setInfo}>
              <Text style={styles.setNumber}>#{parentSet.setNumber}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>⚡ {badgeText}</Text>
            </View>
            <View style={styles.rowCenter}>
              <Text style={styles.rowSummary}>
                {drops.length} {unitLabelPlural}
                {summaryReps != null ? ` · ${summaryReps}r` : ''}
                {summaryWeight != null ? ` · ${summaryWeight}${unit}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={onToggle} style={styles.checkButton}>
              {allCompleted ? (
                <View style={styles.checkDone}>
                  <Text style={styles.checkDoneText}>✓</Text>
                </View>
              ) : (
                <Text style={styles.expandIcon}>›</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  }

  // Expanded — same left alignment as SetLogger
  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      <View style={styles.expandedOuter}>
        {/* Top row: tappable to collapse, check button completes + collapses */}
        <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={styles.row}>
          <View style={styles.setInfo}>
            <Text style={styles.setNumber}>#{parentSet.setNumber}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>⚡ {badgeText}</Text>
          </View>
          <View style={styles.rowCenter}>
            <Text style={styles.rowTitle}>Serie #{parentSet.setNumber}</Text>
          </View>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onCompleteAll();
              onToggle();
            }}
            style={styles.checkButton}
          >
            {allCompleted ? (
              <View style={styles.checkDone}>
                <Text style={styles.checkDoneText}>✓</Text>
              </View>
            ) : (
              <View style={styles.checkEmpty} />
            )}
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Drops — indented below the set number */}
        <View style={styles.dropsBlock}>
          {drops.map((drop, index) => (
            <DropRow
              key={drop.id ?? index}
              index={index}
              drop={drop}
              unit={unit}
              label={dropLabel(index)}
              showDelete={drops.length > 1}
              showLine={index < drops.length - 1}
              onUnitChange={onUnitChange}
              onUpdateDrop={onUpdateDrop}
              onDeleteDrop={onDeleteDrop}
              previousWeight={previousWeight}
              previousReps={previousReps}
              maxWeight={maxWeight}
            />
          ))}

          {/* Add drop */}
          <TouchableOpacity onPress={onAddDrop} style={styles.addDropButton}>
            <Text style={{ fontSize: 14, color: colors.accent.secondary }}>+</Text>
            <Text style={styles.addDropText}>Agregar {unitLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Swipeable>
  );
}

function DropRow({
  index,
  drop,
  unit,
  label,
  showDelete,
  showLine,
  onUnitChange,
  onUpdateDrop,
  onDeleteDrop,
  previousWeight = null,
  previousReps = null,
  maxWeight = null,
}: {
  index: number;
  drop: Drop;
  unit: string;
  label: string;
  showDelete: boolean;
  showLine: boolean;
  onUnitChange?: (unit: string) => void;
  onUpdateDrop: (dropIndex: number, updates: { reps?: number; weight?: number }) => void;
  onDeleteDrop: (dropIndex: number) => void;
  previousWeight?: number | null;
  previousReps?: number | null;
  maxWeight?: number | null;
}) {
  // Local state so typing is instant — DB sync happens in the background via onUpdateDrop
  const [reps, setReps] = useState(drop.reps?.toString() ?? '');
  const [weight, setWeight] = useState(drop.weight?.toString() ?? '');

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
    if (previousWeight == null) return unit;
    if (maxWeight != null) {
      return previousWeight >= maxWeight ? `${previousWeight} ▲` : `${previousWeight} ▼`;
    }
    return String(previousWeight);
  };

  const repsPlaceholder = () => (previousReps != null ? String(previousReps) : 'Reps');

  return (
    <View style={styles.dropRow}>
      <View style={styles.dropIndicator}>
        <View style={[styles.dropDot, drop.completed && styles.dropDotCompleted]} />
        {showLine && <View style={styles.dropLine} />}
      </View>

      <View style={styles.dropContent}>
        <Text style={styles.dropLabel}>{label}</Text>
        <View style={styles.dropInputs}>
          <TextInput
            style={styles.dropInput}
            keyboardType="numeric"
            placeholder={repsPlaceholder()}
            placeholderTextColor={colors.text.muted}
            value={reps}
            onChangeText={handleRepsChange}
          />
          <TextInput
            style={styles.dropInput}
            keyboardType="decimal-pad"
            placeholder={weightPlaceholder()}
            placeholderTextColor={colors.text.muted}
            value={weight}
            onChangeText={handleWeightChange}
          />
          {onUnitChange && (
            <TouchableOpacity
              onPress={() => onUnitChange(unit === 'kg' ? 'lbs' : 'kg')}
              style={styles.unitToggle}
            >
              <Text style={styles.unitText}>{unit}</Text>
            </TouchableOpacity>
          )}
          {showDelete && (
            <TouchableOpacity
              onPress={() => onDeleteDrop(index)}
              style={styles.dropDelete}
            >
              <Text style={{ fontSize: 14, color: colors.error }}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const ROW_HEIGHT = 28;

const styles = StyleSheet.create({
  // --- Shared row layout (matches SetLogger) ---
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  setInfo: {
    width: 28,
    alignItems: 'center',
  },
  setNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.muted,
    width: 28,
    textAlign: 'center',
  },
  badge: {
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.warning,
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
  rowTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  checkButton: {
    width: ROW_HEIGHT,
    height: ROW_HEIGHT,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: {
    width: ROW_HEIGHT,
    height: ROW_HEIGHT,
    borderRadius: 2,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDoneText: {
    color: colors.bg.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  checkEmpty: {
    width: ROW_HEIGHT,
    height: ROW_HEIGHT,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: colors.border.primary,
  },
  expandIcon: {
    fontSize: 20,
    color: colors.text.muted,
    fontWeight: '600',
  },

  // --- Expanded ---
  expandedOuter: {
    marginBottom: spacing.xs,
  },
  dropsBlock: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginLeft: 28,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  dropRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  dropIndicator: {
    width: 16,
    alignItems: 'center',
  },
  dropDot: {
    width: 8,
    height: 8,
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
  dropContent: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  dropLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.muted,
    marginBottom: 4,
  },
  dropInputs: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  dropInput: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 14,
    fontFamily: fonts.display,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  dropDelete: {
    padding: 4,
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
  addDropButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
  },
  addDropText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent.secondary,
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
