import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts, fontSizes , fontWeights, borderWidths} from '../lib/theme/tokens';
import { SET_LOGGER } from '../lib/constants/layout';
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
  previousRir?: number | null;
  previousMethod?: string | null;
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
  previousRir = null,
  previousMethod = null,
  previousDropFor,
  maxWeight = null,
}: DropSetLoggerProps) {
  const allCompleted = drops.length > 0 && drops.every((d) => d.completed);
  const swipeableRef = useRef<Swipeable>(null);
  const { t } = useTranslation();

  const badgeText = method === 'dropset' ? 'Drop Set' : method === 'rest_pause' ? 'Rest Pause' : method === 'cluster' ? 'Cluster' : method === 'partial' ? 'Partial' : 'Drop Set';
  const segmentCount = drops.length;
  const unitLabel = t(`methods.${method}.unitLabel`);
  const handleDelete = () => {
    swipeableRef.current?.close();
    onDelete?.();
  };

  const renderRightActions = () => {
    if (!onDelete) return null;
    return (
      <TouchableOpacity onPress={handleDelete} style={styles.deleteAction} accessibilityLabel={t('accessibility.dropSetLogger.deleteSet')} accessibilityRole="button" accessibilityHint={t('accessibility.dropSetLogger.deleteHint')}>
        <Text style={styles.deleteText}>{t('session.swipe.delete')}</Text>
      </TouchableOpacity>
    );
  };

  // Header row: compact summary without inputs
  const renderHeader = () => (
    <View style={styles.container}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={styles.toggleArea} accessibilityLabel={expanded ? t('accessibility.dropSetLogger.collapse') : t('accessibility.dropSetLogger.expand')} accessibilityRole="button" accessibilityHint={expanded ? t('accessibility.dropSetLogger.collapseHint') : t('accessibility.dropSetLogger.expandHint')}>
        <View style={styles.serieCell}>
          <Text style={styles.serieNumber}>{parentSet.setNumber}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>
        <Text style={styles.segmentCount}>{segmentCount}</Text>
      </TouchableOpacity>

      {/* Intensity method change button */}
      {onChangeMethod && (
        <TouchableOpacity
          onPress={onChangeMethod}
          style={styles.intensityButton}
          accessibilityLabel={t('accessibility.dropSetLogger.intensityMethod')}
          accessibilityRole="button"
          accessibilityHint={t('accessibility.dropSetLogger.intensityHint')}
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
        accessibilityLabel={allCompleted ? t('accessibility.dropSetLogger.markIncomplete') : t('accessibility.dropSetLogger.markComplete')}
        accessibilityRole="button"
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
          <TouchableOpacity onPress={onAddDrop} style={styles.addDropButton} accessibilityLabel={t('accessibility.dropActions.addDrop')} accessibilityRole="button" accessibilityHint={t('accessibility.dropActions.addDropHint')}>
            <Text style={{ fontSize: fontSizes.sm, color: colors.accent.secondary }}>+</Text>
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
  const { t } = useTranslation();
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
    onUpdateDrop(index, { reps: isNaN(value) || value <= 0 ? undefined : value });
  };

  const handleWeightChange = (text: string) => {
    setWeight(text);
    const value = parseFloat(text);
    onUpdateDrop(index, { weight: isNaN(value) || value <= 0 ? undefined : value });
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
    return pr != null ? String(pr) : 'R';
  };

  // Label: show previous data if available, otherwise "Drop N" / "CL 1" etc.
  const dropLabel = method === 'cluster' ? 'CL' : method === 'rest_pause' ? 'RP' : method === 'partial' ? 'P' : 'Drop';
  const labelText = prevDrop
    ? `${prevDrop.weight ?? '?'}${unit} × ${prevDrop.reps ?? '?'}r`
    : `${dropLabel} ${index + 1}`;

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
          accessibilityLabel={t('accessibility.dropActions.weight', { number: index + 1 })}
          accessibilityHint={t('accessibility.dropActions.weightHint')}
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
          accessibilityLabel={t('accessibility.dropActions.reps', { number: index + 1 })}
          accessibilityHint={t('accessibility.dropActions.repsHint')}
        />
      </View>

      {/* Spacer for alignment with header's check column */}
      <View style={styles.intensityButton} />

      {/* Delete button */}
      {showDelete ? (
        <TouchableOpacity
          onPress={() => onDeleteDrop(index)}
          style={styles.checkButton}
          accessibilityLabel={t('accessibility.dropActions.deleteDrop', { number: index + 1 })}
          accessibilityRole="button"
          accessibilityHint={t('accessibility.dropActions.deleteDropHint')}
        >
          <Text style={{ fontSize: fontSizes.sm, color: colors.error }}>×</Text>
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
    paddingVertical: spacing.xxs,
  },
  toggleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // --- Columns matching SetLogger exactly ---
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
    fontSize: fontSizes.xs2, fontWeight: fontWeights.extrabold,
    color: colors.accent.primary,
    letterSpacing: 0.3,
  },
  segmentCount: {
    fontSize: fontSizes.xs, fontWeight: fontWeights.semibold,
    color: colors.text.muted,
    marginLeft: spacing.xs,
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
  // --- Expanded drops ---
  dropsBlock: {
    marginTop: 0,
    paddingLeft: spacing.lg + spacing.xs,
  },
  dropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xxs,
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
    marginTop: spacing.xs,
  },
  dropDotCompleted: {
    backgroundColor: colors.accent.primary,
  },
  dropLine: {
    width: 1,
    flex: 1,
    backgroundColor: colors.border.primary,
    marginTop: spacing.xs,
  },
  dropLabelCell: {
    width: SET_LOGGER.PREVIOUS_WIDTH,
    alignItems: 'flex-start',
    paddingLeft: spacing.xs,
  },
  dropLabelText: {
    fontSize: fontSizes.xs, color: colors.text.muted,
    fontFamily: fonts.body,
  },
  // --- Add drop ---
  addDropButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  addDropText: {
    fontSize: fontSizes.sm, color: colors.accent.secondary,
    fontWeight: fontWeights.semibold,
  },
  // --- Swipeable delete ---
  deleteAction: {
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: SET_LOGGER.DELETE_WIDTH,
  },
  deleteText: {
    color: colors.text.primary,
    fontWeight: fontWeights.semibold,
    fontSize: fontSizes.sm
  },
});
