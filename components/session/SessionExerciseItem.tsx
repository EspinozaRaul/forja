import { Text, View, TouchableOpacity, TextInput, Modal, LayoutAnimation } from 'react-native';
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fonts, fontSizes, fontWeights, borderWidths } from '../../lib/theme/tokens';
import { SET_LOGGER } from '../../lib/constants/layout';
import { TIMER_CONFIG } from '../../lib/constants/config';
import { DEFAULT_REST_SECONDS } from '../../lib/constants/routine-defaults';
import { useExercise } from '../../lib/hooks/useExercises';
import { useUpdateExercise } from '../../lib/hooks/useExercises';
import { useSets, useCreateSet, useUpdateSet, useDeleteSet, useDeleteDropSetGroup, useReplaceDropSetGroup } from '../../lib/hooks/useSets';
import { useUpdateExerciseRestTime, useUpdateSessionExerciseNotes } from '../../lib/hooks/useSessions';
import { useConfirmDialog } from '../../lib/hooks/useConfirmDialog';
import { useSettings } from '../../lib/utils/settings';
import { resolveUnit } from '../../lib/utils/weight-unit';
import { haptics } from '../../lib/utils/haptics';
import { findPreviousSetWeight, shouldCelebrateNewRecord } from '../../lib/utils/session-sets';
import { getExerciseName } from '../../lib/utils/exercise-names';
import { now } from '../../lib/utils/date';
import { SetLoggerHeader } from '../../components/SetLoggerHeader';
import { SetLogger } from '../../components/SetLogger';
import { DropSetLogger } from '../../components/DropSetLogger';
import { PartialSetLogger } from '../../components/PartialSetLogger';
import { ExerciseNotes } from '../../components/ExerciseNotes';
import { IntensityMethodPicker, type IntensityMethod } from '../../components/IntensityMethodPicker';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { CollapseChevron } from '../../components/session/CollapseChevron';
import type { SessionExercise, Set, Exercise } from '../../lib/types';

export function SessionExerciseItem({ sessionExercise, sessionId, previousWeightFor, maxWeightFor, onSetCompleted, onNewRecord, onReplace, onDragTap, isDragging, onPairSuperset, onDelete }: {
  sessionExercise: SessionExercise;
  sessionId: number;
  previousWeightFor?: (exerciseId: number, setNumber: number) => { weight: number | null; reps: number | null; rir: number | null; method: string | null; partialReps?: number | null } | undefined;
  maxWeightFor?: (exerciseId: number) => number | null;
  onSetCompleted?: (exerciseName: string, restTime: number) => void;
  onNewRecord?: (exerciseName: string, weight: number, unit: string) => void;
  onReplace?: () => void;
  onDragTap?: () => void;
  isDragging?: boolean;
  onPairSuperset?: () => void;
  onDelete?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { data: exercises } = useExercise(sessionExercise.exerciseId);
  const { data: sets } = useSets(sessionExercise.id);
  // Count of visible rows for the collapsed summary (drop children excluded,
  // same rule as the render loop below).
  const visibleCount = (sets ?? []).filter((s) => {
    if ((s.method === 'dropset' || s.method === 'rest_pause' || s.method === 'cluster') && s.isDropGroup !== true) return false;
    return true;
  }).length;
  const createSet = useCreateSet();
  const updateSet = useUpdateSet();
  const deleteSet = useDeleteSet();
  const deleteDropSetGroup = useDeleteDropSetGroup();
  const replaceDropSetGroup = useReplaceDropSetGroup();
  const updateRestTime = useUpdateExerciseRestTime();
  const updateExercise = useUpdateExercise();
  const updateNotes = useUpdateSessionExerciseNotes();
  const queryClient = useQueryClient();
  const settings = useSettings();
  // Synchronous mirror of weights just typed in this session, so the new-record
  // comparison never depends on the async react-query refetch of `sets`.
  const pendingWeightsRef = useRef(new Map<number, number>());
  const [showRestPicker, setShowRestPicker] = useState(false);
  const [showCustomRest, setShowCustomRest] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const [customSeconds, setCustomSeconds] = useState('');
  const [dropSetMode, setDropSetMode] = useState<number | null>(null); // set ID being converted to drop set
  const [dropSetMethod, setDropSetMethod] = useState<Record<number, 'dropset' | 'rest_pause' | 'cluster' | 'partial'>>({});
  const [dropSetDrafts, setDropSetDrafts] = useState<Record<number, Array<{ weight: number | null; reps: number | null; completed: boolean; rir: number | null }>>>({});
  const [showIntensityPicker, setShowIntensityPicker] = useState(false);
  const [pendingConversionSetId, setPendingConversionSetId] = useState<number | null>(null);
  const [pendingConversionSet, setPendingConversionSet] = useState<Set | null>(null);
  const [expandedDropSets, setExpandedDropSets] = useState<number[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const { dialog: seDialog, showAlert: seShowAlert } = useConfirmDialog();

  const exercise = exercises?.[0];
  const unit = resolveUnit(exercise?.unit, settings.data.weightUnit);
  const currentRestTime = sessionExercise.restTime ?? DEFAULT_REST_SECONDS;

  // Use setNumber for toggle tracking (more stable than ID during optimistic updates)
  const handleToggleDropSet = (setNumber: number) => {
    setExpandedDropSets((prev) => {
      if (prev.includes(setNumber)) {
        return prev.filter((n) => n !== setNumber);
      }
      return [...prev, setNumber];
    });
  };

  const toggleCollapsed = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((c) => !c);
  };

  const handleAddSet = async () => {
    await haptics.press();
    // Next set number = max setNumber across ALL rows (linear + drop children share the group number)
    const maxSetNumber = Math.max(0, ...(sets?.map((s) => s.setNumber) ?? []));
    const nextSetNumber = maxSetNumber + 1;
    await createSet.mutateAsync({
      sessionExerciseId: sessionExercise.id,
      setNumber: nextSetNumber,
    });
  };

  const handleUpdateSet = async (set: Set, updates: { reps?: number; weight?: number; completed?: boolean; rir?: number | null }) => {
    if (updates.weight !== undefined) {
      if (updates.weight > 0) pendingWeightsRef.current.set(set.id, updates.weight);
      else pendingWeightsRef.current.delete(set.id);
    }

    if (updates.completed && !set.completed) {
      await haptics.complete();
      onSetCompleted?.(exercise ? getExerciseName(exercise.name, i18n.language) : t('session.fallbackExercise'), currentRestTime);

      const finalWeight = updates.weight ?? set.weight ?? pendingWeightsRef.current.get(set.id) ?? null;
      if (finalWeight != null && finalWeight > 0) {
        const mergedSets = (sets ?? []).map((s) =>
          pendingWeightsRef.current.has(s.id) ? { ...s, weight: pendingWeightsRef.current.get(s.id) ?? null } : s
        );
        const prevW = findPreviousSetWeight(mergedSets, set.id);
        const phW = previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.weight ?? null;
        const maxW = maxWeightFor?.(sessionExercise.exerciseId) ?? null;
        if (shouldCelebrateNewRecord(finalWeight, prevW, phW, maxW)) {
          void haptics.success();
          const name = exercise ? getExerciseName(exercise.name, i18n.language) : t('session.fallbackExercise');
          onNewRecord?.(name, finalWeight, unit);
        }
      }
    }

    await updateSet.mutateAsync({
      id: set.id,
      data: updates,
      sessionExerciseId: sessionExercise.id,
    });
  };

  const handleDeleteSet = async (setId: number) => {
    await haptics.warning();
    await deleteSet.mutateAsync({
      id: setId,
      sessionExerciseId: sessionExercise.id,
    });
  };

  const handleSetRestTime = async (seconds: number) => {
    await updateRestTime.mutateAsync({ id: sessionExercise.id, restTime: seconds, sessionId });
    setShowRestPicker(false);
  };

  const handleUnitChange = async (unit: string) => {
    if (exercise) {
      await updateExercise.mutateAsync({
        id: exercise.id,
        data: { unit },
      });
    }
  };

  // Intensity method handlers
  const handleOpenIntensityPicker = (setId: number, set: Set) => {
    setPendingConversionSetId(setId);
    setPendingConversionSet(set);
    setShowIntensityPicker(true);
  };

  const handleSelectIntensityMethod = (method: IntensityMethod) => {
    if (pendingConversionSetId === null || !pendingConversionSet) return;

    // Save method to DB immediately — prevents revert when switching to another set
    const isDropMethod = method === 'dropset' || method === 'rest_pause' || method === 'cluster';
    updateSet.mutateAsync({
      id: pendingConversionSetId,
      data: {
        method,
        // Drop methods need isDropGroup=true on the parent set
        isDropGroup: isDropMethod ? true : undefined,
      },
      sessionExerciseId: sessionExercise.id,
    });

    if (method === 'dropset' || method === 'rest_pause' || method === 'cluster') {
      // Auto-save previous set if another was being edited
      if (dropSetMode !== null && dropSetMode !== pendingConversionSetId) {
        const prevDrafts = dropSetDrafts[dropSetMode];
        if (prevDrafts && prevDrafts.length >= 2) {
          handleSaveDropSet(dropSetMode);
        } else {
          // Not enough drops — just cancel the previous editing
          handleCancelDropSet(dropSetMode);
        }
      }

      // Open grouped method editor — start with parent set values only, user adds drops as needed
      setDropSetMode(pendingConversionSetId);
      setDropSetMethod((prev) => ({ ...prev, [pendingConversionSetId]: method }));
      setDropSetDrafts((prev) => ({
        ...prev,
        [pendingConversionSetId]: [
          { weight: pendingConversionSet.weight ?? null, reps: pendingConversionSet.reps ?? null, completed: pendingConversionSet.completed, rir: pendingConversionSet.rir ?? null },
        ],
      }));

    } else if (method === 'partial') {
      // Partial is a single set with C+P — open partial editor
      // Auto-save previous set if another was being edited
      if (dropSetMode !== null && dropSetMode !== pendingConversionSetId) {
        handleCancelDropSet(dropSetMode);
      }

      setDropSetMode(pendingConversionSetId);
      setDropSetMethod((prev) => ({ ...prev, [pendingConversionSetId]: method }));

    } else if (method === 'superset') {
      // Super set is per-exercise: bridge into the partner-selection flow for this exercise
      setPendingConversionSetId(null);
      setPendingConversionSet(null);
      onPairSuperset?.();
      return;
    }
    setPendingConversionSetId(null);
    setPendingConversionSet(null);
  };

  const handleAddDropToSet = (setId: number) => {
    setDropSetDrafts((prev) => ({
      ...prev,
      [setId]: [...(prev[setId] ?? []), { weight: null, reps: null, completed: false, rir: null }],
    }));
  };

  const handleUpdateDrop = (setId: number, dropIndex: number, updates: { reps?: number; weight?: number; completed?: boolean; rir?: number }) => {
    setDropSetDrafts((prev) => {
      const drops = [...(prev[setId] ?? [])];
      drops[dropIndex] = { ...drops[dropIndex], ...updates };
      return { ...prev, [setId]: drops };
    });
  };

  const handleDeleteDrop = (setId: number, dropIndex: number) => {
    setDropSetDrafts((prev) => {
      const drops = [...(prev[setId] ?? [])];
      drops.splice(dropIndex, 1);
      return { ...prev, [setId]: drops };
    });
  };

  const handleSaveDropSet = async (setId: number, dropsOverride?: Array<{ weight: number | null; reps: number | null; completed: boolean; rir: number | null }>) => {
    const drops = dropsOverride ?? dropSetDrafts[setId];
    if (!drops || drops.length < 2) {
      seShowAlert(t('session.dropSet.methodTitle'), t('session.dropSet.minSegments'));
      return;
    }

    const method = dropSetMethod[setId] ?? 'dropset';

    // Capture everything BEFORE any mutation
    const originalSet = sets?.find((s) => s.id === setId);
    if (!originalSet) {
      seShowAlert(t('common.error'), t('session.error.dropSetNotFound'));
      return;
    }
    const setNumber = originalSet.setNumber;
    const seId = sessionExercise.id;
    const queryKey = ['sets', seId];

    // Build the optimistic drop set entries
    const optimisticDrops = drops.map((d, i) => ({
      id: Date.now() + i, // temporary ID
      sessionExerciseId: seId,
      setNumber,
      reps: d.reps ?? null,
      weight: d.weight ?? null,
      completed: d.completed,
      method: method as 'dropset' | 'rest_pause' | 'cluster',
      dropOrder: i + 1,
      isDropGroup: i === 0,
      rir: d.rir ?? null,
      partialReps: null,
      createdAt: now(),
    }));

    // OPTIMISTIC: instantly replace linear set with drop entries in cache
    const previousSets = queryClient.getQueryData<Set[]>(queryKey);
    queryClient.setQueryData<Set[]>(queryKey, (old) => {
      if (!old) return old;
      return old.map((s) => {
        if (s.id === setId) {
          // Replace this linear set with the first drop (group parent)
          return optimisticDrops[0];
        }
        return s;
      }).concat(optimisticDrops.slice(1)); // append remaining drops
    });

    // Auto-expand the saved drop set so toggle works immediately
    setExpandedDropSets((prev) => prev.includes(setNumber) ? prev : [...prev, setNumber]);

    try {
      // Single atomic operation: delete old drops + create new ones
      const newDrops = await replaceDropSetGroup.mutateAsync({
        sessionExerciseId: seId,
        setNumber,
        method,
        drops: drops.map((d) => ({
          reps: d.reps ?? undefined,
          weight: d.weight ?? undefined,
          rir: d.rir ?? undefined,
          completed: d.completed,
        })),
      });
      // Update cache with real data — preserve original position
      if (newDrops && newDrops.length > 0) {
        queryClient.setQueryData<Set[]>(queryKey, (old) => {
          if (!old) return old;
          // Find the original index to preserve position
          const originalIndex = old.findIndex((s) => s.setNumber === setNumber);
          const withoutDrops = old.filter((s) => s.setNumber !== setNumber);
          if (originalIndex === -1 || originalIndex >= withoutDrops.length) {
            // Original not found or was at the end — append
            return [...withoutDrops, ...newDrops];
          }
          // Insert at original position
          const result = [...withoutDrops];
          result.splice(originalIndex, 0, ...newDrops);
          return result;
        });
      }
    } catch (error) {
      // On failure, revert to previous state
      if (previousSets) {
        queryClient.setQueryData(queryKey, previousSets);
      }
      seShowAlert(t('common.error'), t('session.error.dropSetSave'));
    }

    // Clear local state AFTER async save — keeps drafts available during save
    // and prevents clearing drafts of another set being edited concurrently
    setDropSetMode(null);
    setDropSetDrafts((prev) => {
      const next = { ...prev };
      delete next[setId];
      return next;
    });
    setDropSetMethod((prev) => {
      const next = { ...prev };
      delete next[setId];
      return next;
    });
  };

  const handleCancelDropSet = (setId: number) => {
    setDropSetMode(null);
    setDropSetDrafts((prev) => {
      const next = { ...prev };
      delete next[setId];
      return next;
    });
    setDropSetMethod((prev) => {
      const next = { ...prev };
      delete next[setId];
      return next;
    });
  };

  const REST_PRESETS = TIMER_CONFIG.REST_PRESETS;

  const deleteSwipeableRef = useRef<Swipeable>(null);

  const handleSwipeDelete = () => {
    deleteSwipeableRef.current?.close();
    onDelete?.();
  };

  const renderRightActions = () => {
    if (!onDelete) return null;
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
    <>
    <Swipeable
      ref={deleteSwipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
    <View
      style={{
        backgroundColor: isDragging ? colors.bg.active : colors.bg.card,
        borderRadius: borderRadius.sm,
        padding: spacing.sm + spacing.xs,
        marginBottom: spacing.sm + spacing.xs,
        borderWidth: borderWidths.thin,
        borderColor: isDragging ? colors.accent.primary : colors.border.primary,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <TouchableOpacity
          onPress={onDragTap}
          activeOpacity={0.7}
          style={{ gap: spacing.xs, paddingRight: spacing.sm, borderRightWidth: 1, borderRightColor: colors.border.divider }}
        >
          <View style={{ width: 16, height: 2, backgroundColor: isDragging ? colors.accent.primary : colors.text.muted, borderRadius: borderRadius.xs }} />
          <View style={{ width: 16, height: 2, backgroundColor: isDragging ? colors.accent.primary : colors.text.muted, borderRadius: borderRadius.xs }} />
          <View style={{ width: 16, height: 2, backgroundColor: isDragging ? colors.accent.primary : colors.text.muted, borderRadius: borderRadius.xs }} />
        </TouchableOpacity>
        <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary, flex: 1 }} numberOfLines={2} ellipsizeMode="tail">
          {exercise ? getExerciseName(exercise.name, i18n.language) : t('session.unknownExercise')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 0 }}>
          {onPairSuperset && (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onPairSuperset(); }}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.border.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.xs + spacing.xxs, paddingVertical: spacing.xxs }}
            >
              <Text style={{ fontSize: fontSizes.xs2, fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.semibold, color: colors.text.secondary }}>{t('session.superSet')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setShowRestPicker(!showRestPicker)}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.border.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.xs + spacing.xxs, paddingVertical: spacing.xxs }}
          >
            <Text style={{ fontSize: fontSizes.xs2, fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.semibold, color: colors.text.secondary }}>
              {currentRestTime >= 60 ? `${Math.floor(currentRestTime / 60)}m${currentRestTime % 60 > 0 ? ` ${currentRestTime % 60}s` : ''}` : `${currentRestTime}s`}
            </Text>
          </TouchableOpacity>
          {onReplace && (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onReplace(); }}
              style={{ padding: spacing.xxs }}
            >
              <Ionicons name="repeat" size={14} color={colors.accent.primary} />
            </TouchableOpacity>
          )}
          <CollapseChevron collapsed={collapsed} onPress={toggleCollapsed} />
        </View>
      </View>

      {/* Exercise notes */}
      <ExerciseNotes
        notes={sessionExercise.notes}
        noteType={sessionExercise.noteType}
        onNotesChange={(notes, noteType) => updateNotes.mutateAsync({ id: sessionExercise.id, notes, noteType, sessionId })}
      />

      {/* Rest time picker */}
      {showRestPicker && (
        <View style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.sm }}>
            {REST_PRESETS.map((dur) => (
              <TouchableOpacity
                key={dur}
                onPress={() => handleSetRestTime(dur)}
                style={{
                  backgroundColor: currentRestTime === dur ? colors.accent.primary : colors.bg.elevated,
                  borderRadius: borderRadius.sm,
                  paddingHorizontal: spacing.sm + spacing.xs,
                  paddingVertical: spacing.sm,
                  borderWidth: currentRestTime === dur ? 0 : 1,
                  borderColor: colors.border.primary,
                }}
              >
                <Text style={{
                  fontSize: fontSizes.xs, fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.semibold,
                  color: currentRestTime === dur ? colors.bg.primary : colors.text.secondary,
                }}>
                  {dur >= 60 ? `${dur / 60}m` : `${dur}s`}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => {
                const mins = Math.floor(currentRestTime / 60);
                const secs = currentRestTime % 60;
                setCustomMinutes(mins > 0 ? String(mins) : '');
                setCustomSeconds(secs > 0 ? String(secs) : '');
                setShowCustomRest(true);
              }}
              style={{
                backgroundColor: colors.bg.elevated,
                borderRadius: borderRadius.sm,
                paddingHorizontal: spacing.sm + spacing.xs,
                paddingVertical: spacing.sm,
                borderWidth: borderWidths.thin,
                borderColor: colors.accent.primary,
              }}
            >
              <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.semibold, color: colors.text.secondary }}>{t('session.custom')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Custom rest time modal */}
      <Modal accessible={true} visible={showCustomRest} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: colors.overlay.default, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, width: 280, borderWidth: borderWidths.thin, borderColor: colors.border.primary }}>
            <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md, textAlign: 'center' }}>{t('session.dropSet.title')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.md + spacing.xs }}>
              <TextInput
                value={customMinutes}
                onChangeText={setCustomMinutes}
                placeholder="0"
                placeholderTextColor={colors.text.muted}
                keyboardType="number-pad"
                maxLength={3}
                style={{ backgroundColor: colors.border.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + spacing.xs, color: colors.text.primary, fontSize: fontSizes.xl, fontFamily: fonts.display, fontWeight: fontWeights.bold, width: 80, textAlign: 'center' }}
              />
              <Text style={{ fontSize: fontSizes.xl, color: colors.text.secondary, fontWeight: fontWeights.semibold }}>{t('session.dropSet.minutes')}</Text>
              <Text style={{ fontSize: fontSizes.xl, color: colors.text.muted }}>:</Text>
              <TextInput
                value={customSeconds}
                onChangeText={setCustomSeconds}
                placeholder="0"
                placeholderTextColor={colors.text.muted}
                keyboardType="number-pad"
                maxLength={2}
                style={{ backgroundColor: colors.border.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + spacing.xs, color: colors.text.primary, fontSize: fontSizes.xl, fontFamily: fonts.display, fontWeight: fontWeights.bold, width: 80, textAlign: 'center' }}
              />
              <Text style={{ fontSize: fontSizes.xl, color: colors.text.secondary, fontWeight: fontWeights.semibold }}>{t('session.dropSet.seconds')}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm + spacing.xs }}>
              <TouchableOpacity
                onPress={() => setShowCustomRest(false)}
                style={{ flex: 1, paddingVertical: spacing.sm + spacing.xs, borderRadius: borderRadius.sm, backgroundColor: colors.border.primary, alignItems: 'center' }}
              >
                <Text style={{ color: colors.text.secondary, fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.semibold }}>{t('session.dropSet.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const mins = parseInt(customMinutes || '0', 10);
                  const secs = parseInt(customSeconds || '0', 10);
                  const total = mins * 60 + secs;
                  if (total > 0) {
                    handleSetRestTime(total);
                    setShowCustomRest(false);
                  }
                }}
                style={{ flex: 1, paddingVertical: spacing.sm + spacing.xs, borderRadius: borderRadius.sm, backgroundColor: colors.accent.primary, alignItems: 'center' }}
              >
                <Text style={{ color: colors.bg.primary, fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.bold }}>{t('session.dropSet.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {collapsed ? (
        <TouchableOpacity
          onPress={toggleCollapsed}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, backgroundColor: colors.border.primary }}
        >
          <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodyMedium, color: colors.text.secondary }}>
            {t('session.collapsedSummary', { count: visibleCount, label: visibleCount === 1 ? t('session.set') : t('session.sets') })}
          </Text>
        </TouchableOpacity>
      ) : (
      <View>
        <SetLoggerHeader unit={unit} onUnitChange={handleUnitChange} hasPartial={sets?.some((s) => s.method === 'partial') ?? false} />
        {(() => {
        // Pre-process: filter to visible items and assign sequential display numbers
        let displayNumber = 0;
        const visibleItems = sets?.filter((s) => {
          // Drop children are rendered by DropSetLogger, skip them
          if ((s.method === 'dropset' || s.method === 'rest_pause' || s.method === 'cluster') && s.isDropGroup !== true) return false;
          return true;
        }) ?? [];

        return visibleItems.map((set) => {
          displayNumber++;

          // PRIORITY: editing mode takes precedence over persisted drop group
          // This allows changing method on an existing drop group
          if (dropSetMode === set.id) {
            const displaySet = { ...set, setNumber: displayNumber };
            const isPartial = dropSetMethod[set.id] === 'partial';

            if (isPartial) {
              // Partial set editor — C+P breakdown
              return (
                <View key={set.id}>
                   <PartialSetLogger
                    set={displaySet}
                    onUpdate={(updates) => {
                      updateSet.mutateAsync({
                        id: set.id,
                        data: {
                          reps: updates.reps,
                          weight: updates.weight,
                          partialReps: (updates as any).partialReps,
                          completed: updates.completed,
                        },
                        sessionExerciseId: sessionExercise.id,
                      });
                      if (updates.completed && !set.completed) {
                        onSetCompleted?.(exercise ? getExerciseName(exercise.name, i18n.language) : t('session.fallbackExercise'), currentRestTime);
                      }
                    }}
                    onDelete={() => handleDeleteSet(set.id)}
                    onChangeMethod={() => handleOpenIntensityPicker(set.id, set)}
                    unit={unit}
                    previousWeight={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.weight ?? null}
                    previousReps={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.reps ?? null}
                    previousPartialReps={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.partialReps ?? null}
                    previousMethod={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.method ?? null}
                  />
                </View>
              );
            }

            // Drop set / cluster / rest-pause editor
            const drops = dropSetDrafts[set.id] ?? [];
            return (
              <View key={set.id}>
                <DropSetLogger
                  parentSet={displaySet}
                  drops={drops}
                  method={dropSetMethod[set.id] ?? 'dropset'}
                  expanded={true}
                  onToggle={() => {}}
                  onUpdateDrop={(dropIndex, updates) => handleUpdateDrop(set.id, dropIndex, updates)}
                  onAddDrop={() => handleAddDropToSet(set.id)}
                  onDeleteDrop={(dropIndex) => handleDeleteDrop(set.id, dropIndex)}
                  onChangeMethod={() => handleOpenIntensityPicker(set.id, set)}
                  onCompleteAll={() => {
                    const completedDrops = (dropSetDrafts[set.id] ?? []).map((d) => ({ ...d, completed: true }));
                    // Start rest timer BEFORE save — handleSaveDropSet unmounts this component
                    onSetCompleted?.(exercise ? getExerciseName(exercise.name, i18n.language) : t('session.fallbackExercise'), currentRestTime);
                    // Pass completed drops directly — setDropSetDrafts state hasn't updated yet
                    handleSaveDropSet(set.id, completedDrops);
                  }}
                  onUncompleteAll={() => {
                    setDropSetDrafts((prev) => ({
                      ...prev,
                      [set.id]: (prev[set.id] ?? []).map((d) => ({ ...d, completed: false })),
                    }));
                  }}
                unit={unit}
                previousWeight={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.weight ?? null}
                previousReps={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.reps ?? null}
                previousRir={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.rir ?? null}
                previousMethod={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.method ?? null}
                maxWeight={maxWeightFor?.(sessionExercise.exerciseId) ?? null}
              />
              </View>
            );
          }

          // Persisted drop group — show with toggle and check
          if (set.isDropGroup === true && (set.method === 'dropset' || set.method === 'rest_pause' || set.method === 'cluster')) {
            const drops = sets
              ?.filter((s) => (s.method === 'dropset' || s.method === 'rest_pause' || s.method === 'cluster') && s.setNumber === set.setNumber)
              .sort((a, b) => (a.dropOrder ?? 0) - (b.dropOrder ?? 0))
              .map((s) => ({
                id: s.id,
                weight: s.weight,
                reps: s.reps,
                completed: s.completed,
                rir: s.rir,
              })) ?? [];

            const displaySet = { ...set, setNumber: displayNumber };

            return (
              <DropSetLogger
                key={set.id}
                parentSet={displaySet}
                drops={drops}
                method={set.method ?? 'dropset'}
              expanded={expandedDropSets.includes(set.setNumber)}
              onToggle={() => handleToggleDropSet(set.setNumber)}
                onChangeMethod={() => handleOpenIntensityPicker(set.id, set)}
                onUpdateDrop={(dropIndex, updates) => {
                  const dropSet = drops[dropIndex];
                  if (dropSet?.id) {
                    updateSet.mutateAsync({
                      id: dropSet.id,
                      data: updates,
                      sessionExerciseId: sessionExercise.id,
                    });
                  }
                }}
                onDelete={() => {
                  deleteDropSetGroup.mutateAsync({
                    sessionExerciseId: sessionExercise.id,
                    setNumber: set.setNumber,
                  });
                }}
                onAddDrop={() => {
                  const lastDrop = drops[drops.length - 1];
                  if (lastDrop?.id) {
                    const lastWeight = lastDrop.weight;
                    const isDrop = (set.method ?? 'dropset') === 'dropset';
                    createSet.mutateAsync({
                      sessionExerciseId: sessionExercise.id,
                      setNumber: set.setNumber,
                      reps: lastDrop.reps ?? undefined,
                      weight: isDrop ? (lastWeight ? lastWeight - 2.5 : undefined) : (lastWeight ?? undefined),
                      method: set.method ?? 'dropset',
                      dropOrder: drops.length + 1,
                      isDropGroup: false,
                    });
                  }
                }}
                onDeleteDrop={(dropIndex) => {
                  const dropSet = drops[dropIndex];
                  if (dropSet?.id) {
                    deleteSet.mutateAsync({
                      id: dropSet.id,
                      sessionExerciseId: sessionExercise.id,
                    });
                  }
                }}
                onCompleteAll={() => {
                  drops.forEach((drop) => {
                    if (drop.id && !drop.completed) {
                      updateSet.mutateAsync({
                        id: drop.id,
                        data: { completed: true },
                        sessionExerciseId: sessionExercise.id,
                      });
                    }
                  });
                   onSetCompleted?.(exercise ? getExerciseName(exercise.name, i18n.language) : t('session.fallbackExercise'), currentRestTime);
                }}
                onUncompleteAll={() => {
                  drops.forEach((drop) => {
                    if (drop.id && drop.completed) {
                      updateSet.mutateAsync({
                        id: drop.id,
                        data: { completed: false },
                        sessionExerciseId: sessionExercise.id,
                      });
                    }
                  });
                }}
                unit={unit}
                previousWeight={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.weight ?? null}
                previousReps={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.reps ?? null}
                previousMethod={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.method ?? null}
                maxWeight={maxWeightFor?.(sessionExercise.exerciseId) ?? null}
              />
            );
          }

          // Persisted partial set — inline like linear, not grouped
          if (set.method === 'partial') {
            const displaySet = { ...set, setNumber: displayNumber };
            return (
              <PartialSetLogger
                key={set.id}
                set={displaySet}
                onUpdate={(updates) => {
                  updateSet.mutateAsync({
                    id: set.id,
                    data: {
                      reps: updates.reps,
                      weight: updates.weight,
                      partialReps: (updates as any).partialReps,
                      completed: updates.completed,
                    },
                    sessionExerciseId: sessionExercise.id,
                  });
                  if (updates.completed && !set.completed) {
                    onSetCompleted?.(exercise ? getExerciseName(exercise.name, i18n.language) : t('session.fallbackExercise'), currentRestTime);
                  }
                }}
                onDelete={() => handleDeleteSet(set.id)}
                onChangeMethod={() => handleOpenIntensityPicker(set.id, set)}
                unit={unit}
                previousWeight={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.weight ?? null}
                previousReps={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.reps ?? null}
                previousPartialReps={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.partialReps ?? null}
              />
            );
          }

          // Regular set or linear set — show with convert button
          const displaySet = { ...set, setNumber: displayNumber };
          return (
            <SetLogger
              key={set.id}
              set={displaySet}
              onUpdate={(updates) => handleUpdateSet(set, updates)}
              onDelete={() => handleDeleteSet(set.id)}
              unit={unit}
              onOpenIntensityPicker={() => handleOpenIntensityPicker(set.id, set)}
              previousWeight={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.weight ?? null}
              previousReps={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.reps ?? null}
              previousRir={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.rir ?? null}
              maxWeight={maxWeightFor?.(sessionExercise.exerciseId) ?? null}
            />
          );
        });
      })()}
      </View>
      )}
      {!collapsed && (
      <View style={{ marginTop: spacing.sm }}>
        <Button
          title={t('session.addSet')}
          variant="secondary"
          compact
          onPress={handleAddSet}
          loading={createSet.isPending}
        />
      </View>
      )}

      <IntensityMethodPicker
        visible={showIntensityPicker}
        onSelect={handleSelectIntensityMethod}
        onClose={() => {
          setShowIntensityPicker(false);
          setPendingConversionSetId(null);
          setPendingConversionSet(null);
        }}
      />
    </View>
    </Swipeable>
    <ConfirmDialog
      visible={seDialog.visible}
      title={seDialog.title}
      message={seDialog.message}
      confirmLabel={seDialog.confirmLabel}
      cancelLabel={seDialog.cancelLabel}
      destructive={seDialog.destructive}
      onConfirm={seDialog.onConfirm}
      onCancel={seDialog.onCancel}
    />
    </>
  );
}
