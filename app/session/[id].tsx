import { Text, View, TouchableOpacity, Modal, Pressable, BackHandler, Platform } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView, useKeyboardState } from 'react-native-keyboard-controller';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { now } from '../../lib/utils/date';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fonts, fontSizes , fontWeights, borderWidths} from '../../lib/theme/tokens';
import { MODAL, SET_LOGGER } from '../../lib/constants/layout';
import { TIMER_CONFIG } from '../../lib/constants/config';
import { useSession, useSessionExercises, useSessionExercisesWithSets, useCompleteSession, useAddExerciseToSession, useUpdateExerciseRestTime, useUpdateSessionExerciseOrder, useReplaceSessionExercise, useCreateSuperSetPair, useUnlinkSuperSet, useDeleteSessionExercise, useDeleteSession, useLastSessionForRoutine, useUpdateSessionExerciseNotes, useLastSetsPerExercise } from '../../lib/hooks/useSessions';

const SESSION_KEY = ['sessions'];
import { useExercise, useExercises, useUpdateExercise, useMaxWeightByExerciseIds, useLastWeightByExerciseIds, useLastRepsByExerciseIds, useLastRirByRoutineExerciseIds } from '../../lib/hooks/useExercises';
import { useRoutineExercises, useRemoveExerciseFromRoutine, useAddExerciseToRoutine, useUpdateRoutineExerciseOrder, useUpdateRoutineExerciseTargets } from '../../lib/hooks/useRoutines';
import { useSets, useCreateSet, useUpdateSet, useDeleteSet, useDeleteDropSetGroup, useReplaceDropSetGroup } from '../../lib/hooks/useSets';
import { Timer } from '../../components/Timer';
import { RestTimer } from '../../components/RestTimer';
import { SetLogger } from '../../components/SetLogger';
import { SetLoggerHeader } from '../../components/SetLoggerHeader';
import { DropSetLogger } from '../../components/DropSetLogger';
import { PartialSetLogger } from '../../components/PartialSetLogger';
import { ExerciseNotes } from '../../components/ExerciseNotes';
import { IntensityMethodPicker, type IntensityMethod } from '../../components/IntensityMethodPicker';
import { Button } from '../../components/ui/Button';
import { ExercisePicker } from '../../components/ExercisePicker';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { CollapseChevron } from '../../components/session/CollapseChevron';
import { SessionExerciseItem } from '../../components/session/SessionExerciseItem';
import { SupersetSetRow, SupersetBlock, SupersetSeries } from '../../components/session/SupersetComponents';
import { EmptyState } from '../../components/ui/EmptyState';
import { NewRecordBanner } from '../../components/NewRecordBanner';
import { getExerciseName } from '../../lib/utils/exercise-names';
import { DEFAULT_TARGET_SETS, DEFAULT_TARGET_REPS, DEFAULT_REST_SECONDS } from '../../lib/constants/routine-defaults';
import { haptics } from '../../lib/utils/haptics';
import { detectRoutineDiff, summarizeDiff, type RoutineDiff, type DiffSetRow } from '../../lib/utils/routine-diff';
import { findPreviousSetWeight, shouldCelebrateNewRecord } from '../../lib/utils/session-sets';
import { useSettings } from '../../lib/utils/settings';
import { resolveUnit } from '../../lib/utils/weight-unit';
import type { SessionExercise, Set, Exercise, RoutineExercise } from '../../lib/types';
import type { SessionExerciseWithSets } from '../../lib/db/queries';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../../lib/hooks/useConfirmDialog';
import { useTranslation } from 'react-i18next';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const isKeyboardVisible = useKeyboardState((state) => state.isVisible);
  const sessionId = parseInt(id, 10);
  const { t, i18n } = useTranslation();

  const { data: sessions, isLoading: sessionLoading } = useSession(sessionId);
  const { data: sessionExercises, isLoading: exercisesLoading } = useSessionExercises(sessionId);
  const completeSession = useCompleteSession();
  const deleteSession = useDeleteSession();
  const addExerciseToSession = useAddExerciseToSession();
  const updateOrder = useUpdateSessionExerciseOrder();
  const { data: allExercises } = useExercises();

  const session = sessions?.[0];
  const isLoading = sessionLoading || exercisesLoading;

  // Routine diff / upsync (End Session structural comparison)
  const { data: routineExercises, refetch: refetchRoutineExercises } = useRoutineExercises(session?.routineId ?? 0);
  const { data: sessionExercisesWithSets, refetch: refetchSessionWithSets } = useSessionExercisesWithSets(sessionId);
  const removeExerciseFromRoutine = useRemoveExerciseFromRoutine();
  const addExerciseToRoutine = useAddExerciseToRoutine();
  const updateRoutineExerciseOrder = useUpdateRoutineExerciseOrder();
  const updateRoutineExerciseTargets = useUpdateRoutineExerciseTargets();

  const sortedExercises = sessionExercises ? [...sessionExercises].sort((a, b) => a.order - b.order) : [];

  // Previous-session data for the "peso previo" placeholders (guidance only).
  const { data: lastSession } = useLastSessionForRoutine(session?.routineId ?? 0);
  const lastWeights = useLastWeightByExerciseIds(
    sessionExercises?.map((se) => se.exerciseId) ?? []
  );
  const lastReps = useLastRepsByExerciseIds(
    sessionExercises?.map((se) => se.exerciseId) ?? []
  );
  const { data: maxWeights } = useMaxWeightByExerciseIds(
    sessionExercises?.map((se) => se.exerciseId) ?? []
  );
  const { data: lastRirByExercise } = useLastRirByRoutineExerciseIds(
    session?.routineId ?? 0,
    sessionExercises?.map((se) => se.exerciseId) ?? []
  );
  // Global last sets per exercise (across ALL routines) — primary source for "Anterior"
  const { data: lastSetsGlobal } = useLastSetsPerExercise(
    sessionExercises?.map((se) => se.exerciseId) ?? []
  );

  // Guard: invalid sessionId — hooks above are safe because queries with NaN return empty
  if (isNaN(sessionId)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, padding: spacing.md }}>
        <EmptyState title={t('session.notFound')} />
      </View>
    );
  }

  // Previous values per exerciseId + setNumber from the last completed session
  // across ALL routines. Prefer the drop group parent (isDropGroup === true, the
  // heaviest first drop) or a plain linear set; fall back to any set with the
  // same setNumber. The fallback works PER FIELD: if the matching set left a
  // field empty, fall back to the most recent recorded value for the exercise
  // overall (weight and reps independently). These are guidance-only
  // placeholders — they never get saved.
  const getPreviousForExercise = (exerciseId: number, setNumber: number) => {
    let weight: number | null = null;
    let reps: number | null = null;
    let rir: number | null = null;
    let method: string | null = null;
    let partialReps: number | null = null;

    // Primary source: global last sets for this exercise (across ALL routines)
    const globalSets = lastSetsGlobal?.[exerciseId];
    if (globalSets && globalSets.length > 0) {
      // Filter out partial sets — they don't count as full sets for "Anterior" display
      const nonPartial = globalSets.filter((s) => s.method !== 'partial');
      const setsToUse = nonPartial.length > 0 ? nonPartial : globalSets;
      const withNumber = setsToUse.filter((s) => s.setNumber === setNumber);
      if (withNumber.length > 0) {
        const preferred = withNumber.find((s) => s.isDropGroup === true || s.dropOrder == null);
        const chosen = preferred ?? withNumber[0];
        weight = chosen.weight != null ? chosen.weight : null;
        reps = chosen.reps != null ? chosen.reps : null;
        rir = chosen.rir != null ? chosen.rir : null;
        method = chosen.method ?? null;
        partialReps = chosen.partialReps ?? null;
      }
    }

    // Fallback: last session of this routine (for setNumber-specific data)
    if (weight == null && reps == null) {
      const prevSets = lastSession?.exercises?.find((se) => se.exerciseId === exerciseId)?.sets;
      if (prevSets && prevSets.length > 0) {
        const nonPartial = prevSets.filter((s) => s.method !== 'partial');
        const setsToUse = nonPartial.length > 0 ? nonPartial : prevSets;
        const withNumber = setsToUse.filter((s) => s.setNumber === setNumber);
        if (withNumber.length > 0) {
          const preferred = withNumber.find((s) => s.isDropGroup === true || s.dropOrder == null);
          const chosen = preferred ?? withNumber[0];
          weight = chosen.weight != null ? chosen.weight : null;
          reps = chosen.reps != null ? chosen.reps : null;
          rir = chosen.rir != null ? chosen.rir : null;
          method = chosen.method ?? null;
          partialReps = chosen.partialReps ?? null;
        }
      }
    }

    // Per-field fallback: most recent recorded value for the exercise overall
    if (weight == null) weight = lastWeights.data?.[exerciseId]?.weight ?? null;
    if (reps == null) reps = lastReps.data?.[exerciseId]?.reps ?? null;
    // RIR fallback: use lastRirByExercise from routine-level query
    if (rir == null) {
      const bySet = lastRirByExercise?.[exerciseId];
      if (bySet && bySet[setNumber] != null) {
        rir = bySet[setNumber];
      }
    }
    return weight != null || reps != null || rir != null ? { weight, reps, rir, method, partialReps } : undefined;
  };

  const getMaxWeightForExercise = (exerciseId: number) =>
    maxWeights?.[exerciseId] ?? null;

  const getExerciseNameForSession = (se: SessionExercise): string => {
    const ex = allExercises?.find((e) => e.id === se.exerciseId);
    return ex ? getExerciseName(ex.name, i18n.language) : t('session.fallbackExercise');
  };

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerState, setPickerState] = useState({ search: '', selectedMuscle: 'Todos', selectedIds: [] as number[] });
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restDuration, setRestDuration] = useState(DEFAULT_REST_SECONDS);
  const [restExerciseName, setRestExerciseName] = useState('');
  const [restartKey, setRestartKey] = useState(0);
  const [replaceId, setReplaceId] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [supersetPartnerMode, setSupersetPartnerMode] = useState<{ id: number } | null>(null);
  const [showSupersetCatalog, setShowSupersetCatalog] = useState(false);
  const [supersetFirstId, setSupersetFirstId] = useState<number | null>(null);
  const replaceSessionExercise = useReplaceSessionExercise();
  const createSuperSetPair = useCreateSuperSetPair();
  const unlinkSuperSet = useUnlinkSuperSet();
  const deleteSessionExercise = useDeleteSessionExercise();
  const [showRoutineDiffModal, setShowRoutineDiffModal] = useState(false);
  const [pendingDiff, setPendingDiff] = useState<RoutineDiff | null>(null);
  const [applyingRoutineUpdate, setApplyingRoutineUpdate] = useState(false);
  const [recordNotif, setRecordNotif] = useState<{ exerciseName: string; weight: number; unit: string; nonce: number } | null>(null);
  const recordNonceRef = useRef(0);
  const [confirmAction, setConfirmAction] = useState<null | 'end' | 'cancel'>(null);
  const [autoStartTimer, setAutoStartTimer] = useState(false);
  const { dialog, showAlert, showConfirm, showThreeOption } = useConfirmDialog();

  // Android hardware back button — prevent accidental session loss
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      showThreeOption(
        t('session.confirm.exitTitle'),
        t('session.confirm.exitMessage'),
        {
          cancelLabel: t('session.confirm.keepTraining'),
          thirdLabel: t('session.confirm.saveAndExit'),
          confirmLabel: t('session.confirm.discard'),
          onCancel: () => {},
          onThird: () => { router.back(); },
          onConfirm: async () => {
            await deleteSession.mutateAsync(sessionId);
            router.back();
          },
          destructive: true,
        }
      );
      return true;
    });

    return () => handler.remove();
  }, [sessionId]);

  // Alert if session runs longer than 2 hours
  const longSessionAlertedRef = useRef(false);
  useEffect(() => {
    if (elapsedSeconds >= 7200 && !longSessionAlertedRef.current) {
      longSessionAlertedRef.current = true;
      showAlert(t('session.longSession.title'), t('session.longSession.message'));
    }
  }, [elapsedSeconds]);

  const handleNewRecord = (exerciseName: string, weight: number, unit: string) => {
    recordNonceRef.current += 1;
    setRecordNotif({ exerciseName, weight, unit, nonce: recordNonceRef.current });
  };

  const handleDragHandleTap = async (index: number) => {
    if (dragIndex === null) {
      setDragIndex(index);
    } else if (dragIndex === index) {
      setDragIndex(null);
    } else {
      const source = sortedExercises[dragIndex];
      const target = sortedExercises[index];
      if (!source || !target) return;

      // Optimistic update
      const previousExercises = sessionExercises;
      const reordered = sortedExercises.map((se, i) => {
        if (i === dragIndex) return { ...se, order: index + 1 };
        if (i === index) return { ...se, order: dragIndex + 1 };
        return se;
      });
      queryClient.setQueryData([...SESSION_KEY, sessionId, 'exercises'], reordered);

      try {
        await updateOrder.mutateAsync({ id: target.id, order: dragIndex + 1, sessionId });
        await updateOrder.mutateAsync({ id: source.id, order: index + 1, sessionId });
      } catch (error) {
        queryClient.setQueryData([...SESSION_KEY, sessionId, 'exercises'], previousExercises);
        showAlert(t('common.error'), t('session.error.reorder'));
      }
      setDragIndex(null);
    }
  };

  const handleReplaceExercise = async (exercise: { id: number }) => {
    if (replaceId === null) return;
    
    const previousExercises = sessionExercises;
    const updated = sessionExercises?.map((se) =>
      se.id === replaceId ? { ...se, exerciseId: exercise.id } : se
    );
    queryClient.setQueryData([...SESSION_KEY, sessionId, 'exercises'], updated);
    
    try {
      await replaceSessionExercise.mutateAsync({ id: replaceId, exerciseId: exercise.id, sessionId });
    } catch (error) {
      queryClient.setQueryData([...SESSION_KEY, sessionId, 'exercises'], previousExercises);
      showAlert(t('common.error'), t('session.error.replace'));
    }
    setReplaceId(null);
    setShowPicker(false);
  };

  if (isLoading) {
    return <LoadingSpinner message={t('session.loadingMessage')} />;
  }

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, padding: spacing.md }}>
        <EmptyState title={t('session.notFound')} />
      </View>
    );
  }

  const confirmEndSession = () => {
    setConfirmAction('end');
  };

  const cancelSessionAndLeave = () => {
    setConfirmAction('cancel');
  };

  const confirmDiscardSession = async () => {
    try {
      await haptics.heavy();
      await deleteSession.mutateAsync(sessionId);
      router.back();
    } catch (error) {
      await haptics.error();
      showAlert(t('common.error'), t('session.error.discard'));
    }
  };

  const completeSessionAndNavigate = async () => {
    try {
      await haptics.heavy();
      await completeSession.mutateAsync({
        id: sessionId,
        data: { duration: elapsedSeconds },
      });
      router.push(`/session/history/${sessionId}`);
    } catch (error) {
      await haptics.error();
      showAlert(t('common.error'), t('session.error.end'));
    }
  };

  const buildSetsByExercise = (rows: SessionExerciseWithSets[]): Record<number, DiffSetRow[]> => {
    const result: Record<number, DiffSetRow[]> = {};
    for (const se of rows) {
      result[se.exerciseId] = (se.sets ?? []).map((s) => ({
        setNumber: s.setNumber,
        method: s.method,
        isDropGroup: s.isDropGroup === true,
        dropOrder: s.dropOrder ?? 0,
      }));
    }
    return result;
  };

  const buildRoutineDiff = (routineRows: RoutineExercise[], sessionRows: SessionExerciseWithSets[]): RoutineDiff => {
    const exerciseNames: Record<number, string> = {};
    const addNames = (exerciseIds: number[]) => {
      for (const exerciseId of exerciseIds) {
        if (exerciseNames[exerciseId] !== undefined) continue;
        const ex = allExercises?.find((e) => e.id === exerciseId);
        exerciseNames[exerciseId] = ex ? getExerciseName(ex.name, i18n.language) : t('session.unknownExercise');
      }
    };
    addNames(routineRows.map((r) => r.exerciseId));
    addNames(sessionRows.map((s) => s.exerciseId));

    return detectRoutineDiff({
      routineExercises: routineRows.map((r) => ({
        id: r.id,
        exerciseId: r.exerciseId,
        order: r.order,
        targetSets: r.targetSets ?? DEFAULT_TARGET_SETS,
      })),
      sessionExercises: sessionRows.map((s) => ({ exerciseId: s.exerciseId, order: s.order })),
      setsByExercise: buildSetsByExercise(sessionRows),
      exerciseNames,
    });
  };

  // Re-read routine + session data from the DB so the comparison always uses
  // the freshest state (the per-row set mutations invalidate their own keys).
  const refreshDiffData = async (): Promise<{ routineRows: RoutineExercise[]; sessionRows: SessionExerciseWithSets[] }> => {
    const [routineRes, sessionRes] = await Promise.all([
      refetchRoutineExercises(),
      refetchSessionWithSets(),
    ]);
    return {
      routineRows: routineRes.data ?? routineExercises ?? [],
      sessionRows: sessionRes.data ?? sessionExercisesWithSets ?? [],
    };
  };

  const handleEndSession = async () => {
    if (session.routineId == null) {
      confirmEndSession();
      return;
    }

    let diff: RoutineDiff;
    try {
      const { routineRows, sessionRows } = await refreshDiffData();
      diff = buildRoutineDiff(routineRows, sessionRows);
    } catch (error) {
      // Fall back to the plain confirmation if the comparison data fails to load.
      confirmEndSession();
      return;
    }

    if (!diff.hasChanges) {
      confirmEndSession();
      return;
    }

    setPendingDiff(diff);
    setShowRoutineDiffModal(true);
  };

  const applyRoutineUpsync = async (diff: RoutineDiff) => {
    if (session.routineId == null) return;

    const { routineRows, sessionRows } = await refreshDiffData();
    const routineRowByExercise = new Map(routineRows.map((r) => [r.exerciseId, r]));
    const sessionRowByExercise = new Map(sessionRows.map((s) => [s.exerciseId, s]));

    // removed: routine rows whose exerciseId is absent from the session
    for (const entry of diff.removed) {
      const row = routineRowByExercise.get(entry.exerciseId);
      if (row) await removeExerciseFromRoutine.mutateAsync(row.id);
    }

    // added: session exercises not in the routine → insert with session order
    // and the default targets. A partial session (e.g. only 1 set logged for a
    // brand new exercise) must NOT pin a low target like 1 into the template —
    // use the same default (3 sets × 10 reps) that handleAddExercise uses when
    // building routines, so the Home preview never shows degraded values.
    for (const entry of diff.added) {
      if (routineRowByExercise.has(entry.exerciseId)) continue; // idempotent retry
      const se = sessionRowByExercise.get(entry.exerciseId);
      if (!se) continue;
      await addExerciseToRoutine.mutateAsync({
        routineId: session.routineId,
        exerciseId: entry.exerciseId,
        order: se.order,
        targetSets: DEFAULT_TARGET_SETS,
        targetReps: DEFAULT_TARGET_REPS,
      });
    }

    // volumeChanged: exercises present in both → update targets keeping routine reps
    for (const entry of diff.volumeChanged) {
      const row = routineRowByExercise.get(entry.exerciseId);
      if (!row) continue;
      await updateRoutineExerciseTargets.mutateAsync({
        id: row.id,
        data: { targetSets: entry.toSets, targetReps: row.targetReps ?? DEFAULT_TARGET_REPS },
      });
    }

    // reordered: exercises present in both → new order from the session sequence
    if (diff.reordered) {
      const sessionSorted = [...sessionRows].sort((a, b) => a.order - b.order);
      const positionByExercise = new Map<number, number>();
      sessionSorted.forEach((se, i) => {
        positionByExercise.set(se.exerciseId, i + 1);
      });
      for (const [exerciseId, row] of routineRowByExercise) {
        if (!sessionRowByExercise.has(exerciseId)) continue;
        const position = positionByExercise.get(exerciseId);
        if (position == null) continue;
        if (row.order !== position) {
          await updateRoutineExerciseOrder.mutateAsync({ id: row.id, order: position });
        }
      }
    }
  };

  const handleUpdateRoutine = async () => {
    if (!pendingDiff) return;
    setApplyingRoutineUpdate(true);
    try {
      await applyRoutineUpsync(pendingDiff);
      setShowRoutineDiffModal(false);
      setPendingDiff(null);
      await completeSessionAndNavigate();
    } catch (error) {
      await haptics.error();
      setApplyingRoutineUpdate(false);
      showAlert(t('common.error'), t('session.error.updateRoutine'));
    }
  };

  const handleSaveSessionOnly = () => {
    setShowRoutineDiffModal(false);
    setPendingDiff(null);
    completeSessionAndNavigate();
  };

  const handleAddExercise = async (exercise: { id: number }) => {
    try {
      await addExerciseToSession.mutateAsync({
        sessionId,
        exerciseId: exercise.id,
        order: (sessionExercises?.length ?? 0) + 1,
      });
      setShowPicker(false);
    } catch (error) {
      showAlert(t('common.error'), t('session.error.addExercise'));
    }
  };

  const handlePairSuperset = async (chosen: SessionExercise) => {
    if (!supersetPartnerMode) return;
    const firstId = supersetPartnerMode.id;
    setSupersetPartnerMode(null);
    try {
      await createSuperSetPair.mutateAsync({ firstId, secondId: chosen.id, sessionId });
    } catch (error) {
      showAlert(t('common.error'), t('session.error.createSuperSet'));
    }
  };

  const handleSupersetCatalogSelect = async (exercise: Exercise) => {
    const firstId = supersetFirstId;
    setShowSupersetCatalog(false);
    setSupersetFirstId(null);
    if (firstId == null) return;
    try {
      // Cannot pair an exercise with itself
      const sameExercise = sessionExercises?.find((se) => se.id === firstId);
      if (sameExercise && sameExercise.exerciseId === exercise.id) {
        showAlert(t('session.error.warning'), t('session.error.selfPair'));
        return;
      }
      // If the selected exercise is already in this session and unpaired, pair directly with it
      const existing = sessionExercises?.find(
        (se) => se.exerciseId === exercise.id && se.id !== firstId && se.supersetPairId == null
      );
      if (existing) {
        await createSuperSetPair.mutateAsync({ firstId, secondId: existing.id, sessionId });
        return;
      }
      // Otherwise add it to the session first, then pair with the new session exercise
      const added = await addExerciseToSession.mutateAsync({
        sessionId,
        exerciseId: exercise.id,
        order: (sessionExercises?.length ?? 0) + 1,
      });
      const newSe = added[0];
      if (!newSe) {
        showAlert(t('common.error'), t('session.error.createSuperSet'));
        return;
      }
      await createSuperSetPair.mutateAsync({ firstId, secondId: newSe.id, sessionId });
    } catch (error) {
      showAlert(t('common.error'), t('session.error.createSuperSet'));
    }
  };

  const handleDeleteExercise = (se: SessionExercise) => {
    showConfirm(
      t('session.confirm.deleteExercise'),
      t('session.confirm.deleteExerciseMessage', { name: getExerciseNameForSession(se) }),
      async () => {
        await haptics.warning();
        await deleteSessionExercise.mutateAsync({ id: se.id, sessionId });
      },
      { confirmLabel: t('session.confirm.delete'), destructive: true }
    );
  };

  const handleDeleteSuperSet = (members: SessionExercise[]) => {
    const pairId = members[0]?.supersetPairId;
    const nameA = getExerciseNameForSession(members[0]);
    const nameB = getExerciseNameForSession(members[1]);
    showConfirm(
      t('session.confirm.deleteSuperSet'),
      t('session.confirm.deleteSuperSetMessage', { nameA, nameB }),
      async () => {
        await haptics.warning();
        if (pairId != null) {
          await unlinkSuperSet.mutateAsync({ pairId, sessionId });
        }
        await deleteSessionExercise.mutateAsync({ id: members[0].id, sessionId });
        if (members[1]) {
          await deleteSessionExercise.mutateAsync({ id: members[1].id, sessionId });
        }
      },
      { confirmLabel: t('session.confirm.delete'), destructive: true }
    );
  };

  return (
    <>
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {/* Timer + Header — fixed top */}
      <View style={{ backgroundColor: colors.bg.card, paddingHorizontal: spacing.md, paddingTop: insets.top + spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: spacing.sm + spacing.xs }}>
            <Text style={{ fontSize: fontSizes.xl, color: colors.accent.primary }}>←</Text>
          </TouchableOpacity>
           <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary, flex: 1 }}>{t('session.title')}</Text>
        </View>
        <Timer sessionId={id} onTimeUpdate={setElapsedSeconds} autoStart />
      </View>

      {recordNotif && (
        <NewRecordBanner
          key={recordNotif.nonce}
          exerciseName={recordNotif.exerciseName}
          weight={recordNotif.weight}
          unit={recordNotif.unit}
          onDismiss={() => setRecordNotif(null)}
        />
      )}

      {/* Exercises — scrollable middle */}
      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: colors.bg.primary }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={spacing.md + spacing.sm}
      >
        <View style={{ padding: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm + spacing.xs }}>
            <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>{t('session.exercises')}</Text>
            <TouchableOpacity
              onPress={() => setShowPicker(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm }}
            >
              <Text style={{ fontSize: fontSizes.sm, color: colors.accent.primary }}>{t('session.add')}</Text>
            </TouchableOpacity>
          </View>

          {dragIndex !== null && (
            <View style={{ backgroundColor: colors.bg.active, borderRadius: borderRadius.sm, padding: spacing.sm + spacing.xs, marginBottom: spacing.sm, borderWidth: borderWidths.thin, borderColor: colors.accent.primary }}>
              <Text style={{ fontSize: fontSizes.sm, color: colors.accent.primary, textAlign: 'center' }}>
                {t('session.swapInstruction')}
              </Text>
            </View>
          )}

          {sortedExercises.length === 0 ? (
            <EmptyState title={t('session.noExercises')} message={t('session.noExercisesMessage')} />
          ) : (
            (() => {
              const pairs = new Map<number, SessionExercise[]>();
              sortedExercises.forEach((se) => {
                if (se.supersetPairId == null) return;
                const members = pairs.get(se.supersetPairId) ?? [];
                members.push(se);
                pairs.set(se.supersetPairId, members);
              });

              const rows: ReactNode[] = [];
              const renderedInPair = new Set<number>();
              sortedExercises.forEach((se, index) => {
                if (renderedInPair.has(se.id)) return;
                if (se.supersetPairId != null) {
                  const members = pairs.get(se.supersetPairId) ?? [];
                  if (members.length === 2) {
                    renderedInPair.add(members[0].id);
                    renderedInPair.add(members[1].id);
                    rows.push(
                      <SupersetBlock
                        key={members[0].id}
                        exercises={members}
                        sessionId={sessionId}
                        nameA={getExerciseNameForSession(members[0])}
                        nameB={getExerciseNameForSession(members[1])}
                        previousWeightFor={getPreviousForExercise}
                        maxWeightFor={getMaxWeightForExercise}
                        onNewRecord={handleNewRecord}
                        onDeletePair={() => handleDeleteSuperSet(members)}
                        onSetCompleted={(exerciseName, restTime) => {
                          setRestExerciseName(exerciseName);
                          setRestDuration(restTime);
                          setAutoStartTimer(true);
                          setRestartKey((k) => k + 1);
                          setShowRestTimer(true);
                        }}
                      />
                    );
                    return;
                  }
                  // Orphan: pairId set but only one row has it → render standalone below.
                }
                rows.push(
                  <Animated.View key={se.id} layout={LinearTransition.duration(200)}>
                    <SessionExerciseItem
                      sessionExercise={se}
                      sessionId={sessionId}
                      previousWeightFor={getPreviousForExercise}
                      maxWeightFor={getMaxWeightForExercise}
                      onNewRecord={handleNewRecord}
                      onSetCompleted={(exerciseName, restTime) => {
                        setRestExerciseName(exerciseName);
                        setRestDuration(restTime);
                        setAutoStartTimer(true);
                        setRestartKey((k) => k + 1);
                        setShowRestTimer(true);
                      }}
                      onReplace={() => { setReplaceId(se.id); setShowPicker(true); }}
                      onDragTap={() => handleDragHandleTap(index)}
                      isDragging={dragIndex === index}
                      onPairSuperset={() => setSupersetPartnerMode({ id: se.id })}
                      onDelete={() => handleDeleteExercise(se)}
                    />
                  </Animated.View>
                );
              });
              return rows;
            })()
          )}
        </View>
      </KeyboardAwareScrollView>

      {/* Bottom — fixed: rest timer + end session */}
      <KeyboardStickyView style={{ backgroundColor: colors.bg.card, borderTopWidth: 1, borderTopColor: colors.border.primary, paddingBottom: insets.bottom + (isKeyboardVisible ? 0 : spacing.sm) }}>
        <View style={{ paddingHorizontal: spacing.md, paddingTop: showRestTimer ? spacing.xs : 0 }}>
          {showRestTimer && restExerciseName ? (
            <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.secondary, marginBottom: spacing.xs, textAlign: 'center' }}>
              {t('session.restLabel', { name: restExerciseName })}
            </Text>
          ) : null}
          <RestTimer
            sessionId={id}
            duration={restDuration}
            autoStart={autoStartTimer}
            visible={showRestTimer}
            restartKey={restartKey}
            onComplete={() => setShowRestTimer(false)}
            onSkip={() => setShowRestTimer(false)}
            onDurationChange={setRestDuration}
            onRestored={() => setShowRestTimer(true)}
          />
        </View>

        {!isKeyboardVisible && (
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={cancelSessionAndLeave}
              style={{ flex: 1, backgroundColor: colors.bg.elevated, borderWidth: borderWidths.thin, borderColor: colors.border.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center' }}
            >
              <Text style={{ color: colors.text.secondary, fontFamily: fonts.bodySemiBold, fontSize: fontSizes.lg }}>{t('session.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleEndSession}
              style={{ flex: 1, backgroundColor: colors.error, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center' }}
            >
              <Text style={{ color: colors.text.primary, fontFamily: fonts.bodySemiBold, fontSize: fontSizes.lg }}>{t('session.endButton')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardStickyView>

      <ExercisePicker
        visible={showPicker}
        exercises={allExercises ?? []}
        onSelect={replaceId !== null ? handleReplaceExercise : handleAddExercise}
        onClose={() => { setShowPicker(false); setReplaceId(null); }}
        state={pickerState}
        onStateChange={setPickerState}
      />

      <Modal accessible={true} visible={supersetPartnerMode !== null} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: colors.overlay.default, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md, width: '100%', maxWidth: MODAL.MAX_WIDTH, borderWidth: borderWidths.thin, borderColor: colors.border.primary }}>
            <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary, textAlign: 'center', marginBottom: spacing.xs }}>
              {t('session.superset.title')}
            </Text>
            <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted, textAlign: 'center', marginBottom: spacing.md }}>
              {t('session.superset.subtitle')}
            </Text>
            {supersetPartnerMode &&
              sortedExercises
                .filter((se) => se.id !== supersetPartnerMode.id && se.supersetPairId == null)
                .map((se) => (
                  <TouchableOpacity
                    key={se.id}
                    onPress={() => handlePairSuperset(se)}
                    style={{ paddingVertical: spacing.sm + spacing.xs, paddingHorizontal: spacing.sm, borderRadius: borderRadius.sm }}
                  >
                    <Text style={{ fontSize: fontSizes.md, color: colors.text.primary }}>{getExerciseNameForSession(se)}</Text>
                  </TouchableOpacity>
                ))}
{supersetPartnerMode &&
                sortedExercises.filter((se) => se.id !== supersetPartnerMode.id && se.supersetPairId == null).length === 0 && (
                  <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted, textAlign: 'center', paddingVertical: spacing.sm }}>
                    {t('session.superset.noAvailable')}
                  </Text>
                )}
              <TouchableOpacity
                onPress={() => {
                  if (supersetPartnerMode) {
                    // Close the superset modal first: iOS cannot present a second Modal
                    // (the catalog ExercisePicker) on top of an already-visible one.
                    setSupersetFirstId(supersetPartnerMode.id);
                    setSupersetPartnerMode(null);
                    setShowSupersetCatalog(true);
                  }
                }}
                style={{ marginTop: spacing.xs, paddingVertical: spacing.sm + spacing.xs, borderRadius: borderRadius.sm, backgroundColor: colors.accent.primary, alignItems: 'center' }}
              >
                <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.semibold, color: colors.bg.primary }}>
                  {t('session.superset.searchCatalog')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSupersetPartnerMode(null)}
                style={{ marginTop: spacing.sm, paddingVertical: spacing.sm, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border.divider }}
              >
                <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.semibold, color: colors.text.secondary }}>{t('session.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <ExercisePicker
          visible={showSupersetCatalog}
          exercises={allExercises ?? []}
          onSelect={handleSupersetCatalogSelect}
          onClose={() => { setShowSupersetCatalog(false); setSupersetFirstId(null); }}
        />

        <Modal
          visible={showRoutineDiffModal}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!applyingRoutineUpdate) setShowRoutineDiffModal(false);
          }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: colors.overlay.default, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}
            onPress={() => {
              if (!applyingRoutineUpdate) setShowRoutineDiffModal(false);
            }}
          >
            <Pressable style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md, width: '100%', maxWidth: MODAL.MAX_WIDTH, borderWidth: borderWidths.thin, borderColor: colors.border.primary }}>
              <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary, textAlign: 'center', marginBottom: spacing.sm }}>
                {t('session.diff.title')}
              </Text>
              <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted, textAlign: 'center', marginBottom: spacing.md }}>
                {t('session.diff.message')}
              </Text>
              <View style={{ marginBottom: spacing.md }}>
                {(pendingDiff ? summarizeDiff(pendingDiff) : []).map((line) => (
                  <Text key={line} style={{ fontSize: fontSizes.sm, fontFamily: fonts.body, color: colors.text.primary, marginBottom: spacing.xs }}>
                    • {line}
                  </Text>
                ))}
              </View>
              <Button
                title={t('session.diff.updateRoutine')}
                variant="primary"
                onPress={handleUpdateRoutine}
                loading={applyingRoutineUpdate}
                disabled={applyingRoutineUpdate}
              />
              <View style={{ height: spacing.sm }} />
              <Button
                title={t('session.diff.saveOnly')}
                variant="secondary"
                onPress={handleSaveSessionOnly}
                disabled={applyingRoutineUpdate}
              />
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={confirmAction !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirmAction(null)}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: colors.overlay.default, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}
            onPress={() => setConfirmAction(null)}
          >
            <Pressable style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md, width: '100%', maxWidth: MODAL.MAX_WIDTH, borderWidth: borderWidths.thin, borderColor: colors.border.primary }}>
              <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary, textAlign: 'center', marginBottom: spacing.sm }}>
                {confirmAction === 'cancel' ? t('session.confirm.cancelSession') : t('session.confirm.endSession')}
              </Text>
              <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted, textAlign: 'center', marginBottom: spacing.md }}>
                {confirmAction === 'cancel'
                  ? t('session.confirm.cancelSessionMessage')
                  : t('session.confirm.endSessionMessage')}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title={t('session.confirm.back')}
                    variant="secondary"
                    onPress={() => setConfirmAction(null)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title={confirmAction === 'cancel' ? t('session.confirm.discard') : t('session.confirm.finish')}
                    variant="danger"
                    onPress={() => {
                      const action = confirmAction;
                      setConfirmAction(null);
                      if (action === 'cancel') {
                        confirmDiscardSession();
                      } else if (action === 'end') {
                        completeSessionAndNavigate();
                      }
                    }}
                  />
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
      <ConfirmDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        confirmLabel={dialog.confirmLabel}
        cancelLabel={dialog.cancelLabel}
        destructive={dialog.destructive}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.onCancel}
        thirdLabel={dialog.thirdLabel}
        onThird={dialog.onThird}
        thirdDestructive={dialog.thirdDestructive}
      />
    </>
    );
  }

