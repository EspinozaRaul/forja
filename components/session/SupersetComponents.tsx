import { useState, useRef } from 'react';
import { Text, View, TouchableOpacity, TextInput, LayoutAnimation } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts, fontSizes, fontWeights, borderWidths } from '../../lib/theme/tokens';
import { SET_LOGGER } from '../../lib/constants/layout';
import { DEFAULT_REST_SECONDS } from '../../lib/constants/routine-defaults';
import { haptics } from '../../lib/utils/haptics';
import { findPreviousSetWeight, shouldCelebrateNewRecord } from '../../lib/utils/session-sets';
import { useSettings } from '../../lib/utils/settings';
import { resolveUnit } from '../../lib/utils/weight-unit';
import { useSets, useCreateSet, useUpdateSet, useDeleteSet } from '../../lib/hooks/useSets';
import { useExercise, useUpdateExercise } from '../../lib/hooks/useExercises';
import { useUnlinkSuperSet } from '../../lib/hooks/useSessions';
import { useConfirmDialog } from '../../lib/hooks/useConfirmDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { CollapseChevron } from '../../components/session/CollapseChevron';
import type { SessionExercise, Set, Exercise } from '../../lib/types';

export function SupersetSetRow({ set, label, unit, previousWeight = null, previousReps = null, previousRir = null, maxWeight = null, onUnitChange, onUpdate }: {
  set: Set;
  label: string;
  unit: string;
  previousWeight?: number | null;
  previousReps?: number | null;
  previousRir?: number | null;
  maxWeight?: number | null;
  onUnitChange?: (unit: string) => void;
  onUpdate: (updates: { reps?: number; weight?: number; completed?: boolean }) => void;
}) {
  const { t } = useTranslation();
  const [reps, setReps] = useState(set.reps?.toString() ?? '');
  const [weight, setWeight] = useState(set.weight?.toString() ?? '');

  const weightPlaceholder = () => {
    if (previousWeight == null) return unit;
    if (maxWeight != null) {
      return previousWeight >= maxWeight ? `${previousWeight} ▲` : `${previousWeight} ▼`;
    }
    return String(previousWeight);
  };

  const repsPlaceholder = () => (previousReps != null ? String(previousReps) : t('session.reps'));

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

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}>
      <Text numberOfLines={1} style={{ width: 64, fontSize: fontSizes.xs, fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.semibold, color: colors.text.muted }}>
        {label}
      </Text>
      <View style={{ flex: 1, backgroundColor: colors.bg.elevated, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignItems: 'center' }}>
        <TextInput
          style={{ fontSize: fontSizes.md, fontFamily: fonts.display, fontWeight: fontWeights.semibold, color: colors.text.primary, textAlign: 'center', width: '100%' }}
          keyboardType="decimal-pad"
          placeholder={weightPlaceholder()}
          placeholderTextColor={colors.text.muted}
          value={weight}
          onChangeText={handleWeightChange}
        />
      </View>
      <View style={{ flex: 1, backgroundColor: colors.bg.elevated, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignItems: 'center' }}>
        <TextInput
          style={{ fontSize: fontSizes.md, fontFamily: fonts.display, fontWeight: fontWeights.semibold, color: colors.text.primary, textAlign: 'center', width: '100%' }}
          keyboardType="numeric"
          placeholder={repsPlaceholder()}
          placeholderTextColor={colors.text.muted}
          value={reps}
          onChangeText={handleRepsChange}
        />
      </View>
      {onUnitChange && (
        <TouchableOpacity
          onPress={() => onUnitChange(unit === 'kg' ? 'lbs' : 'kg')}
          style={{ backgroundColor: 'transparent', borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, minWidth: 36, alignItems: 'center' }}
        >
          <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.semibold, color: colors.text.muted }}>{unit}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={() => onUpdate({ completed: !set.completed })}
        style={[
          { width: SET_LOGGER.CHECK_SIZE, height: SET_LOGGER.CHECK_SIZE, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center' },
          set.completed
            ? { backgroundColor: colors.accent.primary }
            : { backgroundColor: 'transparent', borderWidth: borderWidths.medium, borderColor: colors.border.primary },
        ]}
      >
        <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.bold, color: set.completed ? colors.bg.primary : colors.text.secondary }}>
          {set.completed ? '✓' : ''}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export function SupersetBlock({ exercises, sessionId, nameA, nameB, previousWeightFor, maxWeightFor, onSetCompleted, onNewRecord, onDeletePair }: {
  exercises: SessionExercise[];
  sessionId: number;
  nameA: string;
  nameB: string;
  previousWeightFor?: (exerciseId: number, setNumber: number) => { weight: number | null; reps: number | null; rir: number | null; method: string | null; partialReps?: number | null } | undefined;
  maxWeightFor?: (exerciseId: number) => number | null;
  onSetCompleted?: (exerciseName: string, restTime: number) => void;
  onNewRecord?: (exerciseName: string, weight: number, unit: string) => void;
  onDeletePair?: () => void;
}) {
  const { t } = useTranslation();
  const a = exercises[0];
  const b = exercises[1];
  const unlinkSuperSet = useUnlinkSuperSet();
  const createSet = useCreateSet();
  const updateSet = useUpdateSet();
  const deleteSet = useDeleteSet();
  const updateExercise = useUpdateExercise();
  const settings = useSettings();
  const pairId = a?.supersetPairId;

  // Synchronous mirror of weights just typed in this session, so the new-record
  // comparison never depends on the async react-query refetch of `sets`.
  const pendingWeightsRef = useRef(new Map<number, number>());
  const [collapsed, setCollapsed] = useState(false);
  const { dialog: sbDialog, showConfirm: sbShowConfirm } = useConfirmDialog();

  const toggleCollapsed = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((c) => !c);
  };

  const { data: setsA } = useSets(a?.id ?? 0);
  const { data: setsB } = useSets(b?.id ?? 0);
  const { data: exA } = useExercise(a?.exerciseId ?? 0);
  const { data: exB } = useExercise(b?.exerciseId ?? 0);

  const restA = a?.restTime ?? DEFAULT_REST_SECONDS;
  const restB = b?.restTime ?? DEFAULT_REST_SECONDS;
  const unitA = resolveUnit(exA?.[0]?.unit, settings.data.weightUnit);
  const unitB = resolveUnit(exB?.[0]?.unit, settings.data.weightUnit);

  const handleUnitChange = async (exercise: Exercise | undefined, unit: string) => {
    if (exercise) {
      await updateExercise.mutateAsync({
        id: exercise.id,
        data: { unit },
      });
    }
  };

  // Filter out grouped-method children per side, same as SessionExerciseItem.
  const visibleSets = (sets: Set[] | undefined) =>
    (sets ?? []).filter((s) => {
      if ((s.method === 'dropset' || s.method === 'rest_pause' || s.method === 'cluster') && s.isDropGroup !== true) return false;
      return true;
    });

  const visibleA = visibleSets(setsA);
  const visibleB = visibleSets(setsB);

  // Merge both sides by setNumber (union, ascending). A number present only on one side renders that single sub-row.
  const seriesRows = (() => {
    const byNumber = new Map<number, { setNumber: number; a?: Set; b?: Set }>();
    visibleA.forEach((s) => {
      const row = byNumber.get(s.setNumber) ?? { setNumber: s.setNumber };
      row.a = s;
      byNumber.set(s.setNumber, row);
    });
    visibleB.forEach((s) => {
      const row = byNumber.get(s.setNumber) ?? { setNumber: s.setNumber };
      row.b = s;
      byNumber.set(s.setNumber, row);
    });
    return [...byNumber.values()].sort((x, y) => x.setNumber - y.setNumber);
  })();

  const handleAddSeries = async () => {
    await haptics.press();
    const maxSetNumber = Math.max(
      0,
      ...(setsA?.map((s) => s.setNumber) ?? []),
      ...(setsB?.map((s) => s.setNumber) ?? [])
    );
    const nextSetNumber = maxSetNumber + 1;
    if (a) {
      await createSet.mutateAsync({ sessionExerciseId: a.id, setNumber: nextSetNumber });
    }
    if (b) {
      await createSet.mutateAsync({ sessionExerciseId: b.id, setNumber: nextSetNumber });
    }
  };

  const handleUpdateSet = async (set: Set, updates: { reps?: number; weight?: number; completed?: boolean }) => {
    const isA = set.sessionExerciseId === a?.id;
    const sourceSets = (isA ? (setsA ?? []) : (setsB ?? [])).map((s) =>
      pendingWeightsRef.current.has(s.id) ? { ...s, weight: pendingWeightsRef.current.get(s.id) ?? null } : s
    );
    const prevW = findPreviousSetWeight(sourceSets, set.id);
    const exerciseId = isA ? a?.exerciseId : b?.exerciseId;
    const phW = previousWeightFor?.(exerciseId ?? 0, set.setNumber)?.weight ?? null;
    const maxW = maxWeightFor?.(exerciseId ?? 0) ?? null;
    if (
      updates.weight != null &&
      shouldCelebrateNewRecord(updates.weight, prevW, phW, maxW)
    ) {
      void haptics.success();
      onNewRecord?.(isA ? nameA : nameB, updates.weight, isA ? unitA : unitB);
    }
    if (updates.weight !== undefined) {
      if (updates.weight > 0) pendingWeightsRef.current.set(set.id, updates.weight);
      else pendingWeightsRef.current.delete(set.id);
    }
    if (updates.completed && !set.completed) {
      await haptics.complete();
      onSetCompleted?.(isA ? nameA : nameB, isA ? restA : restB);
    }
    await updateSet.mutateAsync({
      id: set.id,
      data: updates,
      sessionExerciseId: set.sessionExerciseId,
    });
  };

  const handleDeleteSeries = (row: { setNumber: number; a?: Set; b?: Set }) => {
    sbShowConfirm(
      t('session.confirm.deleteSet'),
      t('session.confirm.deleteSetMessage'),
      async () => {
        await haptics.warning();
        if (row.a) {
          await deleteSet.mutateAsync({ id: row.a.id, sessionExerciseId: row.a.sessionExerciseId });
        }
        if (row.b) {
          await deleteSet.mutateAsync({ id: row.b.id, sessionExerciseId: row.b.sessionExerciseId });
        }
      },
      { confirmLabel: t('session.confirm.delete'), destructive: true }
    );
  };

  const handleUnlink = () => {
    if (pairId == null) return;
    sbShowConfirm(
      t('session.confirm.unlinkSuperSet'),
      t('session.confirm.unlinkSuperSetMessage'),
      () => unlinkSuperSet.mutateAsync({ pairId, sessionId }),
      { confirmLabel: t('session.confirm.unlink'), destructive: true }
    );
  };

  const supersetSwipeableRef = useRef<Swipeable>(null);

  const handleSwipeDeletePair = () => {
    supersetSwipeableRef.current?.close();
    onDeletePair?.();
  };

  const renderDeleteActions = () => {
    if (!onDeletePair) return null;
    return (
      <TouchableOpacity
        onPress={handleSwipeDeletePair}
        style={{ backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center', width: SET_LOGGER.DELETE_WIDTH, borderRadius: borderRadius.sm, marginLeft: spacing.sm }}
      >
        <Text style={{ color: colors.text.primary, fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.bold, fontSize: fontSizes.sm }}>{t('session.swipe.delete')}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <>
    <Animated.View layout={LinearTransition.duration(200)}>
      <Swipeable
        ref={supersetSwipeableRef}
        renderRightActions={renderDeleteActions}
        overshootRight={false}
        friction={2}
      >
      <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.sm, padding: spacing.sm + spacing.xs, marginBottom: spacing.sm + spacing.xs, borderWidth: borderWidths.thin, borderColor: colors.border.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary, flex: 1 }}>
            {nameA} ⟷ {nameB}
          </Text>
          <CollapseChevron collapsed={collapsed} onPress={toggleCollapsed} />
        </View>
        {!collapsed && (
        <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.muted, marginTop: spacing.xs, marginBottom: spacing.sm }}>
          {t('session.superset.instruction')}
        </Text>
        )}

        {collapsed ? (
        <TouchableOpacity
          onPress={toggleCollapsed}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, backgroundColor: colors.border.primary }}
        >
          <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodyMedium, color: colors.text.secondary }}>
            {t('session.collapsedSummary', { count: seriesRows.length, label: seriesRows.length === 1 ? t('session.set') : t('session.sets') })}
          </Text>
        </TouchableOpacity>
        ) : (
        seriesRows.map((row) => (
          <SupersetSeries
            key={row.setNumber}
            row={row}
            nameA={nameA}
            nameB={nameB}
            unitA={unitA}
            unitB={unitB}
            exerciseIdA={a?.exerciseId ?? 0}
            exerciseIdB={b?.exerciseId ?? 0}
            onUnitChangeA={(unit) => handleUnitChange(exA?.[0], unit)}
            onUnitChangeB={(unit) => handleUnitChange(exB?.[0], unit)}
            previousWeightFor={previousWeightFor}
            maxWeightFor={maxWeightFor}
            onUpdateSet={handleUpdateSet}
            onDeleteSeries={handleDeleteSeries}
          />
        ))
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border.divider, paddingTop: spacing.sm }}>
          {!collapsed && (
          <>
          <TouchableOpacity
            onPress={handleAddSeries}
            disabled={createSet.isPending}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs }}
          >
            <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodyMedium, color: createSet.isPending ? colors.text.muted : colors.accent.primary }}>
              {t('session.superset.addSeries')}
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted }}>·</Text>
          <TouchableOpacity onPress={handleUnlink} style={{ paddingVertical: spacing.xs }}>
            <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted }}>{t('session.superset.unlink')}</Text>
          </TouchableOpacity>
          </>
          )}
        </View>
      </View>
      </Swipeable>
    </Animated.View>
    <ConfirmDialog
      visible={sbDialog.visible}
      title={sbDialog.title}
      message={sbDialog.message}
      confirmLabel={sbDialog.confirmLabel}
      cancelLabel={sbDialog.cancelLabel}
      destructive={sbDialog.destructive}
      onConfirm={sbDialog.onConfirm}
      onCancel={sbDialog.onCancel}
    />
    </>
  );
}

export function SupersetSeries({ row, nameA, nameB, unitA, unitB, exerciseIdA, exerciseIdB, onUnitChangeA, onUnitChangeB, previousWeightFor, maxWeightFor, onUpdateSet, onDeleteSeries }: {
  row: { setNumber: number; a?: Set; b?: Set };
  nameA: string;
  nameB: string;
  unitA: string;
  unitB: string;
  exerciseIdA: number;
  exerciseIdB: number;
  onUnitChangeA?: (unit: string) => void;
  onUnitChangeB?: (unit: string) => void;
  previousWeightFor?: (exerciseId: number, setNumber: number) => { weight: number | null; reps: number | null; rir: number | null; method: string | null; partialReps?: number | null } | undefined;
  maxWeightFor?: (exerciseId: number) => number | null;
  onUpdateSet: (set: Set, updates: { reps?: number; weight?: number; completed?: boolean }) => void;
  onDeleteSeries: (row: { setNumber: number; a?: Set; b?: Set }) => void;
}) {
  const { t } = useTranslation();
  const swipeableRef = useRef<Swipeable>(null);

  const prevA = row.a ? previousWeightFor?.(exerciseIdA, row.a.setNumber) : undefined;
  const prevB = row.b ? previousWeightFor?.(exerciseIdB, row.b.setNumber) : undefined;
  const maxA = maxWeightFor?.(exerciseIdA) ?? null;
  const maxB = maxWeightFor?.(exerciseIdB) ?? null;

  const handleSwipeDelete = () => {
    swipeableRef.current?.close();
    onDeleteSeries(row);
  };

  const renderRightActions = () => {
    return (
      <TouchableOpacity
        onPress={handleSwipeDelete}
        style={{ backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center', width: SET_LOGGER.DELETE_WIDTH, borderRadius: borderRadius.sm, marginLeft: spacing.sm }}
      >
        <Text style={{ color: colors.text.primary, fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.bold, fontSize: fontSizes.sm }}>{t('session.swipe.delete')}</Text>
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
      <View style={{ marginBottom: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodyMedium, color: colors.text.muted }}>
            {t('session.superset.setNumber', { number: row.setNumber })}
          </Text>
          <TouchableOpacity
            onPress={() => { swipeableRef.current?.close(); onDeleteSeries(row); }}
            style={{ marginLeft: 'auto', paddingVertical: spacing.xs, paddingLeft: spacing.sm, paddingRight: spacing.xs }}
          >
            <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.semibold, color: colors.text.muted }}>×</Text>
          </TouchableOpacity>
        </View>
        {row.a ? (
          <SupersetSetRow
            key={`a-${row.a.id}`}
            set={row.a}
            label={nameA}
            unit={unitA}
            previousWeight={prevA?.weight ?? null}
            previousReps={prevA?.reps ?? null}
            previousRir={prevA?.rir ?? null}
            maxWeight={maxA}
            onUnitChange={onUnitChangeA}
            onUpdate={(updates) => onUpdateSet(row.a!, updates)}
          />
        ) : null}
        {row.b ? (
          <SupersetSetRow
            key={`b-${row.b.id}`}
            set={row.b}
            label={nameB}
            unit={unitB}
            previousWeight={prevB?.weight ?? null}
            previousReps={prevB?.reps ?? null}
            previousRir={prevB?.rir ?? null}
            maxWeight={maxB}
            onUnitChange={onUnitChangeB}
            onUpdate={(updates) => onUpdateSet(row.b!, updates)}
          />
        ) : null}
    </View>
    </Swipeable>
  );
}
