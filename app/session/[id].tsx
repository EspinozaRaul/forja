import { Text, View, TouchableOpacity, TextInput, Modal, Pressable, LayoutAnimation, BackHandler, Platform } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fonts } from '../../lib/theme/tokens';
import { useSession, useSessionExercises, useSessionExercisesWithSets, useCompleteSession, useAddExerciseToSession, useUpdateExerciseRestTime, useUpdateSessionExerciseOrder, useReplaceSessionExercise, useCreateSuperSetPair, useUnlinkSuperSet, useDeleteSessionExercise, useDeleteSession, useLastSessionForRoutine, useUpdateSessionExerciseNotes } from '../../lib/hooks/useSessions';

const SESSION_KEY = ['sessions'];
import { useExercise, useExercises, useUpdateExercise, useMaxWeightByExerciseIds, useLastWeightByExerciseIds, useLastRepsByExerciseIds, useLastRirByRoutineExerciseIds } from '../../lib/hooks/useExercises';
import { useRoutineExercises, useRemoveExerciseFromRoutine, useAddExerciseToRoutine, useUpdateRoutineExerciseOrder, useUpdateRoutineExerciseTargets } from '../../lib/hooks/useRoutines';
import { useSets, useCreateSet, useCreateDropSets, useUpdateSet, useDeleteSet, useDeleteDropSetGroup, useReplaceDropSetGroup } from '../../lib/hooks/useSets';
import { Timer } from '../../components/Timer';
import { RestTimer } from '../../components/RestTimer';
import { SetLogger } from '../../components/SetLogger';
import { SetLoggerHeader } from '../../components/SetLoggerHeader';
import { DropSetLogger } from '../../components/DropSetLogger';
import { ExerciseNotes } from '../../components/ExerciseNotes';
import { IntensityMethodPicker, type IntensityMethod } from '../../components/IntensityMethodPicker';
import { Button } from '../../components/ui/Button';
import { ExercisePicker } from '../../components/ExercisePicker';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
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

  // Guard: invalid sessionId — hooks above are safe because queries with NaN return empty
  if (isNaN(sessionId)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, padding: spacing.md }}>
        <EmptyState title={t('session.notFound')} />
      </View>
    );
  }

  // Previous values per exerciseId + setNumber from the last completed session
  // of THIS routine. Prefer the drop group parent (isDropGroup === true, the
  // heaviest first drop) or a plain linear set; fall back to any set with the
  // same setNumber. The fallback works PER FIELD: if the matching set left a
  // field empty, fall back to the most recent recorded value for the exercise
  // overall (weight and reps independently). These are guidance-only
  // placeholders — they never get saved.
  const getPreviousForExercise = (exerciseId: number, setNumber: number) => {
    let weight: number | null = null;
    let reps: number | null = null;
    let rir: number | null = null;
    const prevSets = lastSession?.exercises?.find((se) => se.exerciseId === exerciseId)?.sets;
    if (prevSets && prevSets.length > 0) {
      const withNumber = prevSets.filter((s) => s.setNumber === setNumber);
      if (withNumber.length > 0) {
        const preferred = withNumber.find((s) => s.isDropGroup === true || s.dropOrder == null);
        const chosen = preferred ?? withNumber[0];
        weight = chosen.weight != null ? chosen.weight : null;
        reps = chosen.reps != null ? chosen.reps : null;
        rir = chosen.rir != null ? chosen.rir : null;
      }
    }
    if (weight == null) weight = lastWeights.data?.[exerciseId]?.weight ?? null;
    if (reps == null) reps = lastReps.data?.[exerciseId]?.reps ?? null;
    // RIR fallback: use lastRirByExercise from routine-level query
    if (rir == null) {
      const bySet = lastRirByExercise?.[exerciseId];
      if (bySet && bySet[setNumber] != null) {
        rir = bySet[setNumber];
      }
    }
    return weight != null || reps != null || rir != null ? { weight, reps, rir } : undefined;
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
      <View style={{ backgroundColor: colors.bg.card, paddingHorizontal: spacing.md, paddingTop: insets.top + spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: spacing.sm + spacing.xs }}>
            <Text style={{ fontSize: 20, color: colors.accent.primary }}>←</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.text.primary, flex: 1 }}>{t('session.title')}</Text>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>{t('session.exercises')}</Text>
            <TouchableOpacity
              onPress={() => setShowPicker(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm }}
            >
              <Text style={{ fontSize: 14, color: colors.accent.primary }}>{t('session.add')}</Text>
            </TouchableOpacity>
          </View>

          {dragIndex !== null && (
            <View style={{ backgroundColor: colors.bg.active, borderRadius: borderRadius.sm, padding: spacing.sm + spacing.xs, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.accent.primary }}>
              <Text style={{ fontSize: 12, color: colors.accent.primary, textAlign: 'center' }}>
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
      <View style={{ backgroundColor: colors.bg.card, borderTopWidth: 1, borderTopColor: colors.border.primary, paddingBottom: insets.bottom + spacing.sm }}>
        <View style={{ paddingHorizontal: spacing.md, paddingTop: showRestTimer ? spacing.sm + spacing.xs : 0 }}>
          {showRestTimer && restExerciseName ? (
        <Text style={{ fontSize: 11, fontFamily: fonts.body, color: colors.text.secondary, marginBottom: spacing.xs, textAlign: 'center' }}>
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

        <View style={{ paddingHorizontal: spacing.md, paddingTop: showRestTimer ? spacing.sm : spacing.sm + spacing.xs, flexDirection: 'row', gap: spacing.sm }}>
          <TouchableOpacity
            onPress={cancelSessionAndLeave}
            style={{ flex: 1, backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center' }}
          >
            <Text style={{ color: colors.text.secondary, fontFamily: fonts.bodySemiBold, fontSize: 16 }}>{t('session.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleEndSession}
            style={{ flex: 1, backgroundColor: colors.error, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center' }}
          >
            <Text style={{ color: colors.text.primary, fontFamily: fonts.bodySemiBold, fontSize: 16 }}>{t('session.endButton')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ExercisePicker
        visible={showPicker}
        exercises={allExercises ?? []}
        onSelect={replaceId !== null ? handleReplaceExercise : handleAddExercise}
        onClose={() => { setShowPicker(false); setReplaceId(null); }}
        state={pickerState}
        onStateChange={setPickerState}
      />

      <Modal visible={supersetPartnerMode !== null} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md, width: '100%', maxWidth: 340, borderWidth: 1, borderColor: colors.border.primary }}>
            <Text style={{ fontSize: 17, fontFamily: fonts.bodySemiBold, color: colors.text.primary, textAlign: 'center', marginBottom: 4 }}>
              {t('session.superset.title')}
            </Text>
            <Text style={{ fontSize: 12, color: colors.text.muted, textAlign: 'center', marginBottom: spacing.md }}>
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
                    <Text style={{ fontSize: 14, color: colors.text.primary }}>{getExerciseNameForSession(se)}</Text>
                  </TouchableOpacity>
                ))}
{supersetPartnerMode &&
                sortedExercises.filter((se) => se.id !== supersetPartnerMode.id && se.supersetPairId == null).length === 0 && (
                  <Text style={{ fontSize: 12, color: colors.text.muted, textAlign: 'center', paddingVertical: spacing.sm }}>
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
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.bg.primary }}>
                  {t('session.superset.searchCatalog')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSupersetPartnerMode(null)}
                style={{ marginTop: spacing.sm, paddingVertical: spacing.sm, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border.divider }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary }}>{t('session.cancel')}</Text>
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
            style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}
            onPress={() => {
              if (!applyingRoutineUpdate) setShowRoutineDiffModal(false);
            }}
          >
            <Pressable style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md, width: '100%', maxWidth: 340, borderWidth: 1, borderColor: colors.border.primary }}>
              <Text style={{ fontSize: 17, fontFamily: fonts.bodySemiBold, color: colors.text.primary, textAlign: 'center', marginBottom: spacing.sm }}>
                {t('session.diff.title')}
              </Text>
              <Text style={{ fontSize: 12, color: colors.text.muted, textAlign: 'center', marginBottom: spacing.md }}>
                {t('session.diff.message')}
              </Text>
              <View style={{ marginBottom: spacing.md }}>
                {(pendingDiff ? summarizeDiff(pendingDiff) : []).map((line) => (
                  <Text key={line} style={{ fontSize: 13, fontFamily: fonts.body, color: colors.text.primary, marginBottom: spacing.xs }}>
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
            style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}
            onPress={() => setConfirmAction(null)}
          >
            <Pressable style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md, width: '100%', maxWidth: 340, borderWidth: 1, borderColor: colors.border.primary }}>
              <Text style={{ fontSize: 17, fontFamily: fonts.bodySemiBold, color: colors.text.primary, textAlign: 'center', marginBottom: spacing.sm }}>
                {confirmAction === 'cancel' ? t('session.confirm.cancelSession') : t('session.confirm.endSession')}
              </Text>
              <Text style={{ fontSize: 12, color: colors.text.muted, textAlign: 'center', marginBottom: spacing.md }}>
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

// Minimal linear chevron toggle: a thin two-side "V" drawn with CSS borders,
// rotated to point up (collapse) or down (expand). No emoji, no text.
function CollapseChevron({ collapsed, onPress }: { collapsed: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{ alignItems: 'center', justifyContent: 'center', padding: spacing.xs }}
    >
      <View
        style={{
          width: 10,
          height: 10,
          borderRightWidth: 1.5,
          borderBottomWidth: 1.5,
          borderColor: colors.text.secondary,
          transform: [{ rotate: collapsed ? '45deg' : '-135deg' }],
        }}
      />
    </TouchableOpacity>
  );
}

function SessionExerciseItem({ sessionExercise, sessionId, previousWeightFor, maxWeightFor, onSetCompleted, onNewRecord, onReplace, onDragTap, isDragging, onPairSuperset, onDelete }: {
  sessionExercise: SessionExercise;
  sessionId: number;
  previousWeightFor?: (exerciseId: number, setNumber: number) => { weight: number | null; reps: number | null; rir: number | null } | undefined;
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
  const createDropSets = useCreateDropSets();
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
  const [dropSetMethod, setDropSetMethod] = useState<Record<number, 'dropset' | 'rest_pause' | 'cluster'>>({});
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
      createdAt: new Date(),
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

  const REST_PRESETS = [30, 60, 90, 120, 180];

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
        style={{ backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center', width: 80, borderRadius: borderRadius.sm, marginLeft: spacing.sm }}
      >
        <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 14 }}>{t('session.swipe.delete')}</Text>
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
        borderWidth: 1,
        borderColor: isDragging ? colors.accent.primary : colors.border.primary,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <TouchableOpacity
          onPress={onDragTap}
          activeOpacity={0.7}
          style={{ gap: 3, paddingRight: spacing.sm, borderRightWidth: 1, borderRightColor: colors.border.divider }}
        >
          <View style={{ width: 16, height: 2, backgroundColor: isDragging ? colors.accent.primary : colors.text.muted, borderRadius: 1 }} />
          <View style={{ width: 16, height: 2, backgroundColor: isDragging ? colors.accent.primary : colors.text.muted, borderRadius: 1 }} />
          <View style={{ width: 16, height: 2, backgroundColor: isDragging ? colors.accent.primary : colors.text.muted, borderRadius: 1 }} />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.text.primary, flex: 1 }}>
          {exercise ? getExerciseName(exercise.name, i18n.language) : t('session.unknownExercise')}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {onPairSuperset && (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onPairSuperset(); }}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.border.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text.secondary }}>{t('session.superSet')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setShowRestPicker(!showRestPicker)}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.border.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text.secondary }}>
              {currentRestTime >= 60 ? `${Math.floor(currentRestTime / 60)}m${currentRestTime % 60 > 0 ? ` ${currentRestTime % 60}s` : ''}` : `${currentRestTime}s`}
            </Text>
          </TouchableOpacity>
          {onReplace && (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onReplace(); }}
              style={{ padding: spacing.xs }}
            >
              <Ionicons name="repeat" size={16} color={colors.accent.primary} />
            </TouchableOpacity>
          )}
          <CollapseChevron collapsed={collapsed} onPress={toggleCollapsed} />
        </View>
      </View>

      {/* Exercise notes */}
      <ExerciseNotes
        notes={sessionExercise.notes}
        onNotesChange={(notes) => updateNotes.mutateAsync({ id: sessionExercise.id, notes, sessionId })}
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
                  paddingVertical: 5,
                  borderWidth: currentRestTime === dur ? 0 : 1,
                  borderColor: colors.border.primary,
                }}
              >
                <Text style={{
                  fontSize: 11,
                  fontWeight: '600',
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
                paddingVertical: 5,
                borderWidth: 1,
                borderColor: colors.accent.primary,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text.secondary }}>{t('session.custom')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Custom rest time modal */}
      <Modal visible={showCustomRest} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, width: 280, borderWidth: 1, borderColor: colors.border.primary }}>
            <Text style={{ fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md, textAlign: 'center' }}>{t('session.dropSet.title')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: 20 }}>
              <TextInput
                value={customMinutes}
                onChangeText={setCustomMinutes}
                placeholder="0"
                placeholderTextColor={colors.text.muted}
                keyboardType="number-pad"
                maxLength={3}
                style={{ backgroundColor: colors.border.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + spacing.xs, color: colors.text.primary, fontSize: 24, fontFamily: fonts.display, fontWeight: '700', width: 80, textAlign: 'center' }}
              />
              <Text style={{ fontSize: 20, color: colors.text.secondary, fontWeight: '600' }}>{t('session.dropSet.minutes')}</Text>
              <Text style={{ fontSize: 20, color: colors.text.muted }}>:</Text>
              <TextInput
                value={customSeconds}
                onChangeText={setCustomSeconds}
                placeholder="0"
                placeholderTextColor={colors.text.muted}
                keyboardType="number-pad"
                maxLength={2}
                style={{ backgroundColor: colors.border.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + spacing.xs, color: colors.text.primary, fontSize: 24, fontFamily: fonts.display, fontWeight: '700', width: 80, textAlign: 'center' }}
              />
              <Text style={{ fontSize: 20, color: colors.text.secondary, fontWeight: '600' }}>{t('session.dropSet.seconds')}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm + spacing.xs }}>
              <TouchableOpacity
                onPress={() => setShowCustomRest(false)}
                style={{ flex: 1, paddingVertical: spacing.sm + spacing.xs, borderRadius: borderRadius.sm, backgroundColor: colors.border.primary, alignItems: 'center' }}
              >
                <Text style={{ color: colors.text.secondary, fontWeight: '600' }}>{t('session.dropSet.cancel')}</Text>
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
                <Text style={{ color: colors.bg.primary, fontWeight: '700' }}>{t('session.dropSet.save')}</Text>
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
          <Text style={{ fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.text.secondary }}>
            {t('session.collapsedSummary', { count: visibleCount, label: visibleCount === 1 ? t('session.set') : t('session.sets') })}
          </Text>
        </TouchableOpacity>
      ) : (
      <View>
        <SetLoggerHeader unit={unit} onUnitChange={handleUnitChange} />
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
            const drops = dropSetDrafts[set.id] ?? [];
            const displaySet = { ...set, setNumber: displayNumber };
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
                maxWeight={maxWeightFor?.(sessionExercise.exerciseId) ?? null}
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

function SupersetSetRow({ set, label, unit, previousWeight = null, previousReps = null, previousRir = null, maxWeight = null, onUnitChange, onUpdate }: {
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
      <Text numberOfLines={1} style={{ width: 64, fontSize: 12, fontWeight: '600', color: colors.text.muted }}>
        {label}
      </Text>
      <View style={{ flex: 1, backgroundColor: colors.bg.elevated, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignItems: 'center' }}>
        <TextInput
          style={{ fontSize: 14, fontFamily: fonts.display, fontWeight: '600', color: colors.text.primary, textAlign: 'center', width: '100%' }}
          keyboardType="decimal-pad"
          placeholder={weightPlaceholder()}
          placeholderTextColor={colors.text.muted}
          value={weight}
          onChangeText={handleWeightChange}
        />
      </View>
      <View style={{ flex: 1, backgroundColor: colors.bg.elevated, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignItems: 'center' }}>
        <TextInput
          style={{ fontSize: 14, fontFamily: fonts.display, fontWeight: '600', color: colors.text.primary, textAlign: 'center', width: '100%' }}
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
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text.muted }}>{unit}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={() => onUpdate({ completed: !set.completed })}
        style={[
          { width: 28, height: 28, borderRadius: borderRadius.full, alignItems: 'center', justifyContent: 'center' },
          set.completed
            ? { backgroundColor: colors.accent.primary }
            : { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border.primary },
        ]}
      >
        <Text style={{ fontSize: 14, fontWeight: '700', color: set.completed ? colors.bg.primary : colors.text.secondary }}>
          {set.completed ? '✓' : ''}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function SupersetBlock({ exercises, sessionId, nameA, nameB, previousWeightFor, maxWeightFor, onSetCompleted, onNewRecord, onDeletePair }: {
  exercises: SessionExercise[];
  sessionId: number;
  nameA: string;
  nameB: string;
  previousWeightFor?: (exerciseId: number, setNumber: number) => { weight: number | null; reps: number | null; rir: number | null } | undefined;
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
        style={{ backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center', width: 80, borderRadius: borderRadius.sm, marginLeft: spacing.sm }}
      >
        <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 14 }}>{t('session.swipe.delete')}</Text>
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
      <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.sm, padding: spacing.sm + spacing.xs, marginBottom: spacing.sm + spacing.xs, borderWidth: 1, borderColor: colors.border.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.text.primary, flex: 1 }}>
            {nameA} ⟷ {nameB}
          </Text>
          <CollapseChevron collapsed={collapsed} onPress={toggleCollapsed} />
        </View>
        {!collapsed && (
        <Text style={{ fontSize: 11, fontFamily: fonts.body, color: colors.text.muted, marginTop: spacing.xs, marginBottom: spacing.sm }}>
          {t('session.superset.instruction')}
        </Text>
        )}

        {collapsed ? (
        <TouchableOpacity
          onPress={toggleCollapsed}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, backgroundColor: colors.border.primary }}
        >
          <Text style={{ fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.text.secondary }}>
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
            <Text style={{ fontSize: 13, fontFamily: fonts.bodyMedium, color: createSet.isPending ? colors.text.muted : colors.accent.primary }}>
              {t('session.superset.addSeries')}
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, color: colors.text.muted }}>·</Text>
          <TouchableOpacity onPress={handleUnlink} style={{ paddingVertical: spacing.xs }}>
            <Text style={{ fontSize: 12, color: colors.text.muted }}>{t('session.superset.unlink')}</Text>
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

function SupersetSeries({ row, nameA, nameB, unitA, unitB, exerciseIdA, exerciseIdB, onUnitChangeA, onUnitChangeB, previousWeightFor, maxWeightFor, onUpdateSet, onDeleteSeries }: {
  row: { setNumber: number; a?: Set; b?: Set };
  nameA: string;
  nameB: string;
  unitA: string;
  unitB: string;
  exerciseIdA: number;
  exerciseIdB: number;
  onUnitChangeA?: (unit: string) => void;
  onUnitChangeB?: (unit: string) => void;
  previousWeightFor?: (exerciseId: number, setNumber: number) => { weight: number | null; reps: number | null; rir: number | null } | undefined;
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
        style={{ backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center', width: 80, borderRadius: borderRadius.sm, marginLeft: spacing.sm }}
      >
        <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 14 }}>{t('session.swipe.delete')}</Text>
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
          <Text style={{ fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.text.muted }}>
            {t('session.superset.setNumber', { number: row.setNumber })}
          </Text>
          <TouchableOpacity
            onPress={() => { swipeableRef.current?.close(); onDeleteSeries(row); }}
            style={{ marginLeft: 'auto', paddingVertical: spacing.xs, paddingLeft: spacing.sm, paddingRight: spacing.xs }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.muted }}>×</Text>
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
