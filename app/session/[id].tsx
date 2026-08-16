import { Text, View, ScrollView, Alert, TouchableOpacity, TextInput, Modal, Pressable, LayoutAnimation } from 'react-native';
import { useState, useRef, type ReactNode } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { Swipeable } from 'react-native-gesture-handler';
import { colors, spacing, borderRadius, fonts } from '../../lib/theme/tokens';
import { useSession, useSessionExercises, useSessionExercisesWithSets, useCompleteSession, useAddExerciseToSession, useUpdateExerciseRestTime, useUpdateSessionExerciseOrder, useReplaceSessionExercise, useCreateSuperSetPair, useUnlinkSuperSet, useDeleteSessionExercise, useDeleteSession, useLastSessionForRoutine } from '../../lib/hooks/useSessions';

const SESSION_KEY = ['sessions'];
import { useExercise, useExercises, useUpdateExercise, useMaxWeightByExerciseIds, useLastWeightByExerciseIds, useLastRepsByExerciseIds } from '../../lib/hooks/useExercises';
import { useRoutineExercises, useRemoveExerciseFromRoutine, useAddExerciseToRoutine, useUpdateRoutineExerciseOrder, useUpdateRoutineExerciseTargets } from '../../lib/hooks/useRoutines';
import { useSets, useCreateSet, useCreateDropSets, useUpdateSet, useDeleteSet, useDeleteDropSetGroup } from '../../lib/hooks/useSets';
import { Timer } from '../../components/Timer';
import { RestTimer } from '../../components/RestTimer';
import { SetLogger } from '../../components/SetLogger';
import { DropSetLogger } from '../../components/DropSetLogger';
import { IntensityMethodPicker, type IntensityMethod } from '../../components/IntensityMethodPicker';
import { Button } from '../../components/ui/Button';
import { ExercisePicker } from '../../components/ExercisePicker';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { NewRecordBanner } from '../../components/NewRecordBanner';
import { EXERCISE_NAMES_ES } from '../../lib/db/exercise-names-es';
import { DEFAULT_TARGET_SETS, DEFAULT_TARGET_REPS, DEFAULT_REST_SECONDS } from '../../lib/constants/routine-defaults';
import { haptics } from '../../lib/utils/haptics';
import { detectRoutineDiff, summarizeDiff, type RoutineDiff, type DiffSetRow } from '../../lib/utils/routine-diff';
import { findPreviousSetWeight, shouldCelebrateNewRecord } from '../../lib/utils/session-sets';
import type { SessionExercise, Set, Exercise, RoutineExercise } from '../../lib/types';
import type { SessionExerciseWithSets } from '../../lib/db/queries';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const sessionId = parseInt(id, 10);

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

  const sortedExercises = sessionExercises?.sort((a, b) => a.order - b.order) ?? [];

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
    const prevSets = lastSession?.exercises?.find((se) => se.exerciseId === exerciseId)?.sets;
    if (prevSets && prevSets.length > 0) {
      const withNumber = prevSets.filter((s) => s.setNumber === setNumber);
      if (withNumber.length > 0) {
        const preferred = withNumber.find((s) => s.isDropGroup === true || s.dropOrder == null);
        const chosen = preferred ?? withNumber[0];
        weight = chosen.weight != null ? chosen.weight : null;
        reps = chosen.reps != null ? chosen.reps : null;
      }
    }
    if (weight == null) weight = lastWeights.data?.[exerciseId]?.weight ?? null;
    if (reps == null) reps = lastReps.data?.[exerciseId]?.reps ?? null;
    return weight != null || reps != null ? { weight, reps } : undefined;
  };

  const getMaxWeightForExercise = (exerciseId: number) =>
    maxWeights?.[exerciseId] ?? null;

  const getExerciseName = (se: SessionExercise): string => {
    const ex = allExercises?.find((e) => e.id === se.exerciseId);
    return ex ? (EXERCISE_NAMES_ES[ex.name] || ex.name) : 'Ejercicio';
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
        await updateOrder.mutateAsync({ id: target.id, order: dragIndex + 1 });
        await updateOrder.mutateAsync({ id: source.id, order: index + 1 });
      } catch (error) {
        queryClient.setQueryData([...SESSION_KEY, sessionId, 'exercises'], previousExercises);
        Alert.alert('Error', 'Failed to reorder');
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
      await replaceSessionExercise.mutateAsync({ id: replaceId, exerciseId: exercise.id });
    } catch (error) {
      queryClient.setQueryData([...SESSION_KEY, sessionId, 'exercises'], previousExercises);
      Alert.alert('Error', 'Failed to replace exercise');
    }
    setReplaceId(null);
    setShowPicker(false);
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading session..." />;
  }

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, padding: spacing.md }}>
        <EmptyState title="Session not found" />
      </View>
    );
  }

  const confirmEndSession = () => {
    Alert.alert(
      'End Session',
      'Are you sure you want to end this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Session', style: 'destructive', onPress: completeSessionAndNavigate },
      ]
    );
  };

  const cancelSessionAndLeave = async () => {
    Alert.alert(
      'Cancel Session',
      'This session will be discarded and nothing will be saved. Continue?',
      [
        { text: 'Go Back', style: 'cancel' },
        {
          text: 'Discard Session',
          style: 'destructive',
          onPress: async () => {
            try {
              await haptics.heavy();
              await deleteSession.mutateAsync(sessionId);
              router.back();
            } catch (error) {
              await haptics.error();
              Alert.alert('Error', 'Failed to discard session');
            }
          },
        },
      ]
    );
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
      Alert.alert('Error', 'Failed to end session');
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
        exerciseNames[exerciseId] = ex ? (EXERCISE_NAMES_ES[ex.name] || ex.name) : 'Ejercicio desconocido';
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
      Alert.alert('Error', 'No se pudo actualizar la rutina.');
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
      Alert.alert('Error', 'Failed to add exercise');
    }
  };

  const handlePairSuperset = async (chosen: SessionExercise) => {
    if (!supersetPartnerMode) return;
    const firstId = supersetPartnerMode.id;
    setSupersetPartnerMode(null);
    try {
      await createSuperSetPair.mutateAsync({ firstId, secondId: chosen.id });
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear el Super Set.');
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
        Alert.alert('Aviso', 'No podés emparejar un ejercicio consigo mismo.');
        return;
      }
      // If the selected exercise is already in this session and unpaired, pair directly with it
      const existing = sessionExercises?.find(
        (se) => se.exerciseId === exercise.id && se.id !== firstId && se.supersetPairId == null
      );
      if (existing) {
        await createSuperSetPair.mutateAsync({ firstId, secondId: existing.id });
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
        Alert.alert('Error', 'No se pudo crear el Super Set.');
        return;
      }
      await createSuperSetPair.mutateAsync({ firstId, secondId: newSe.id });
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear el Super Set.');
    }
  };

  const handleDeleteExercise = (se: SessionExercise) => {
    Alert.alert(
      'Eliminar ejercicio',
      `¿Eliminar "${getExerciseName(se)}" de la sesión? Se eliminan sus series.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await haptics.warning();
            await deleteSessionExercise.mutateAsync(se.id);
          },
        },
      ]
    );
  };

  const handleDeleteSuperSet = (members: SessionExercise[]) => {
    const pairId = members[0]?.supersetPairId;
    const nameA = getExerciseName(members[0]);
    const nameB = getExerciseName(members[1]);
    Alert.alert(
      'Eliminar Super Set',
      `¿Eliminar "${nameA}" y "${nameB}" de la sesión? Se eliminan sus series.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await haptics.warning();
            if (pairId != null) {
              await unlinkSuperSet.mutateAsync(pairId);
            }
            await deleteSessionExercise.mutateAsync(members[0].id);
            if (members[1]) {
              await deleteSessionExercise.mutateAsync(members[1].id);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {/* Timer + Header — fixed top */}
      <View style={{ backgroundColor: colors.bg.card, paddingHorizontal: spacing.md, paddingTop: insets.top + spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: spacing.sm + spacing.xs }}>
            <Text style={{ fontSize: 20, color: colors.accent.primary }}>←</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.text.primary, flex: 1 }}>Session</Text>
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
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg.primary }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={{ padding: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>Exercises</Text>
            <TouchableOpacity
              onPress={() => setShowPicker(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm }}
            >
              <Text style={{ fontSize: 14, color: colors.accent.primary }}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {dragIndex !== null && (
            <View style={{ backgroundColor: colors.bg.active, borderRadius: borderRadius.sm, padding: spacing.sm + spacing.xs, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.accent.primary }}>
              <Text style={{ fontSize: 12, color: colors.accent.primary, textAlign: 'center' }}>
                Tap another exercise to swap — or tap the same to cancel
              </Text>
            </View>
          )}

          {sortedExercises.length === 0 ? (
            <EmptyState title="No exercises" message="Add exercises to this session." />
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
                        nameA={getExerciseName(members[0])}
                        nameB={getExerciseName(members[1])}
                        previousWeightFor={getPreviousForExercise}
                        maxWeightFor={getMaxWeightForExercise}
                        onNewRecord={handleNewRecord}
                        onDeletePair={() => handleDeleteSuperSet(members)}
                        onSetCompleted={(exerciseName, restTime) => {
                          setRestExerciseName(exerciseName);
                          setRestDuration(restTime);
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
                      previousWeightFor={getPreviousForExercise}
                      maxWeightFor={getMaxWeightForExercise}
                      onNewRecord={handleNewRecord}
                      onSetCompleted={(exerciseName, restTime) => {
                        setRestExerciseName(exerciseName);
                        setRestDuration(restTime);
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
      </ScrollView>

      {/* Bottom — fixed: rest timer + end session */}
      <View style={{ backgroundColor: colors.bg.card, borderTopWidth: 1, borderTopColor: colors.border.primary, paddingBottom: insets.bottom + spacing.sm }}>
        <View style={{ paddingHorizontal: spacing.md, paddingTop: showRestTimer ? spacing.sm + spacing.xs : 0 }}>
          {showRestTimer && restExerciseName ? (
        <Text style={{ fontSize: 11, fontFamily: fonts.body, color: colors.text.secondary, marginBottom: spacing.xs, textAlign: 'center' }}>
          Descanso: {restExerciseName}
        </Text>
          ) : null}
          <RestTimer
            sessionId={id}
            duration={restDuration}
            autoStart
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
            <Text style={{ color: colors.text.secondary, fontFamily: fonts.bodySemiBold, fontSize: 16 }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleEndSession}
            style={{ flex: 1, backgroundColor: colors.error, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center' }}
          >
            <Text style={{ color: colors.text.primary, fontFamily: fonts.bodySemiBold, fontSize: 16 }}>End Session</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ExercisePicker
        visible={showPicker}
        exercises={allExercises ?? []}
        onSelect={replaceId !== null ? handleReplaceExercise : handleAddExercise}
        onPreview={(exercise) => {
          setShowPicker(false);
          router.push(`/exercise/${exercise.id}`);
        }}
        onClose={() => { setShowPicker(false); setReplaceId(null); }}
        state={pickerState}
        onStateChange={setPickerState}
      />

      <Modal visible={supersetPartnerMode !== null} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}>
          <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md, width: '100%', maxWidth: 340, borderWidth: 1, borderColor: colors.border.primary }}>
            <Text style={{ fontSize: 17, fontFamily: fonts.bodySemiBold, color: colors.text.primary, textAlign: 'center', marginBottom: 4 }}>
              Elegí el ejercicio para el Super Set
            </Text>
            <Text style={{ fontSize: 12, color: colors.text.muted, textAlign: 'center', marginBottom: spacing.md }}>
              Solo se muestran ejercicios sin emparejar
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
                    <Text style={{ fontSize: 14, color: colors.text.primary }}>{getExerciseName(se)}</Text>
                  </TouchableOpacity>
                ))}
{supersetPartnerMode &&
                sortedExercises.filter((se) => se.id !== supersetPartnerMode.id && se.supersetPairId == null).length === 0 && (
                  <Text style={{ fontSize: 12, color: colors.text.muted, textAlign: 'center', paddingVertical: spacing.sm }}>
                    No hay ejercicios disponibles para emparejar.
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
                  + Buscar en catálogo
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSupersetPartnerMode(null)}
                style={{ marginTop: spacing.sm, paddingVertical: spacing.sm, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border.divider }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary }}>Cancelar</Text>
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
                ¿Actualizar la rutina?
              </Text>
              <Text style={{ fontSize: 12, color: colors.text.muted, textAlign: 'center', marginBottom: spacing.md }}>
                La sesión tiene cambios estructurales respecto a tu rutina.
              </Text>
              <View style={{ marginBottom: spacing.md }}>
                {(pendingDiff ? summarizeDiff(pendingDiff) : []).map((line) => (
                  <Text key={line} style={{ fontSize: 13, fontFamily: fonts.body, color: colors.text.primary, marginBottom: spacing.xs }}>
                    • {line}
                  </Text>
                ))}
              </View>
              <Button
                title="Actualizar rutina"
                variant="primary"
                onPress={handleUpdateRoutine}
                loading={applyingRoutineUpdate}
                disabled={applyingRoutineUpdate}
              />
              <View style={{ height: spacing.sm }} />
              <Button
                title="Solo guardar sesión"
                variant="secondary"
                onPress={handleSaveSessionOnly}
                disabled={applyingRoutineUpdate}
              />
            </Pressable>
          </Pressable>
        </Modal>
      </View>
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

function SessionExerciseItem({ sessionExercise, previousWeightFor, maxWeightFor, onSetCompleted, onNewRecord, onReplace, onDragTap, isDragging, onPairSuperset, onDelete }: {
  sessionExercise: SessionExercise;
  previousWeightFor?: (exerciseId: number, setNumber: number) => { weight: number | null; reps: number | null } | undefined;
  maxWeightFor?: (exerciseId: number) => number | null;
  onSetCompleted?: (exerciseName: string, restTime: number) => void;
  onNewRecord?: (exerciseName: string, weight: number, unit: string) => void;
  onReplace?: () => void;
  onDragTap?: () => void;
  isDragging?: boolean;
  onPairSuperset?: () => void;
  onDelete?: () => void;
}) {
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
  const updateRestTime = useUpdateExerciseRestTime();
  const updateExercise = useUpdateExercise();
  const queryClient = useQueryClient();
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

  const exercise = exercises?.[0];
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

  const handleUpdateSet = async (set: Set, updates: { reps?: number; weight?: number; completed?: boolean; rir?: number }) => {
    const mergedSets = (sets ?? []).map((s) =>
      pendingWeightsRef.current.has(s.id) ? { ...s, weight: pendingWeightsRef.current.get(s.id) ?? null } : s
    );
    const prevW = findPreviousSetWeight(mergedSets, set.id);
    // The visible placeholder ("peso previo") is the mark users actually read,
    // so beating it must celebrate even when it is below the all-time max.
    const phW = previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.weight ?? null;
    const maxW = maxWeightFor?.(sessionExercise.exerciseId) ?? null;
    if (
      updates.weight != null &&
      shouldCelebrateNewRecord(updates.weight, prevW, phW, maxW)
    ) {
      void haptics.success();
      const name = exercise ? (EXERCISE_NAMES_ES[exercise.name] || exercise.name) : 'Ejercicio';
      onNewRecord?.(name, updates.weight, exercise?.unit ?? 'kg');
    }
    if (updates.weight !== undefined) {
      if (updates.weight > 0) pendingWeightsRef.current.set(set.id, updates.weight);
      else pendingWeightsRef.current.delete(set.id);
    }
    if (updates.completed && !set.completed) {
      await haptics.complete();
      onSetCompleted?.(exercise ? (EXERCISE_NAMES_ES[exercise.name] || exercise.name) : 'Ejercicio', currentRestTime);
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
    await updateRestTime.mutateAsync({ id: sessionExercise.id, restTime: seconds });
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

  const handleSaveDropSet = async (setId: number) => {
    const drops = dropSetDrafts[setId];
    if (!drops || drops.length < 2) {
      Alert.alert('Método', 'Necesitás al menos 2 segmentos. Agregá otro segmento.');
      return;
    }

    const method = dropSetMethod[setId] ?? 'dropset';

    // Capture everything BEFORE any mutation
    const originalSet = sets?.find((s) => s.id === setId);
    if (!originalSet) {
      Alert.alert('Error', 'No se encontró la serie original.');
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

    // Clear local state immediately
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

    try {
      // Now do the actual DB operations
      // deleteSet + createDropSets both invalidate the exact ['sets', seId] key via onSuccess
      await deleteSet.mutateAsync({
        id: setId,
        sessionExerciseId: seId,
      });
      await createDropSets.mutateAsync({
        sessionExerciseId: seId,
        setNumber,
        method,
        drops: drops.map((d) => ({ reps: d.reps ?? undefined, weight: d.weight ?? undefined, rir: d.rir ?? undefined })),
      });
    } catch (error) {
      // On failure, revert to previous state
      if (previousSets) {
        queryClient.setQueryData(queryKey, previousSets);
      }
      Alert.alert('Error', 'Failed to save drop set');
    }
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
        <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 14 }}>Eliminar</Text>
      </TouchableOpacity>
    );
  };

  return (
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
          {exercise ? (EXERCISE_NAMES_ES[exercise.name] || exercise.name) : 'Ejercicio desconocido'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {onPairSuperset && (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onPairSuperset(); }}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.border.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text.secondary }}>Super Set</Text>
            </TouchableOpacity>
          )}
          {onReplace && (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onReplace(); }}
              style={{ padding: spacing.xs }}
            >
              <Text style={{ fontSize: 14, color: colors.accent.primary }}>↻</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setShowRestPicker(!showRestPicker)}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.border.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text.secondary }}>
              {currentRestTime >= 60 ? `${currentRestTime / 60}m` : `${currentRestTime}s`}
            </Text>
          </TouchableOpacity>
          <CollapseChevron collapsed={collapsed} onPress={toggleCollapsed} />
        </View>
      </View>

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
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text.secondary }}>Custom</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Custom rest time modal */}
      <Modal visible={showCustomRest} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, width: 280, borderWidth: 1, borderColor: colors.border.primary }}>
            <Text style={{ fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md, textAlign: 'center' }}>Tiempo de descanso</Text>
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
              <Text style={{ fontSize: 20, color: colors.text.secondary, fontWeight: '600' }}>min</Text>
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
              <Text style={{ fontSize: 20, color: colors.text.secondary, fontWeight: '600' }}>seg</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm + spacing.xs }}>
              <TouchableOpacity
                onPress={() => setShowCustomRest(false)}
                style={{ flex: 1, paddingVertical: spacing.sm + spacing.xs, borderRadius: borderRadius.sm, backgroundColor: colors.border.primary, alignItems: 'center' }}
              >
                <Text style={{ color: colors.text.secondary, fontWeight: '600' }}>Cancelar</Text>
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
                <Text style={{ color: colors.bg.primary, fontWeight: '700' }}>Guardar</Text>
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
            {visibleCount} {visibleCount === 1 ? 'serie' : 'series'} · tocar para expandir
          </Text>
        </TouchableOpacity>
      ) : (
      (() => {
        // Pre-process: filter to visible items and assign sequential display numbers
        let displayNumber = 0;
        const visibleItems = sets?.filter((s) => {
          // Drop children are rendered by DropSetLogger, skip them
          if ((s.method === 'dropset' || s.method === 'rest_pause' || s.method === 'cluster') && s.isDropGroup !== true) return false;
          return true;
        }) ?? [];

        return visibleItems.map((set) => {
          displayNumber++;

          // If this set is a drop group, show DropSetLogger
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
                }}
                unit={exercise?.unit ?? 'kg'}
                previousWeight={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.weight ?? null}
                previousReps={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.reps ?? null}
                maxWeight={maxWeightFor?.(sessionExercise.exerciseId) ?? null}
              />
            );
          }

          // If we're in drop set editing mode for this set
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
                  onCompleteAll={() => {
                    setDropSetDrafts((prev) => ({
                      ...prev,
                      [set.id]: (prev[set.id] ?? []).map((d) => ({ ...d, completed: true })),
                    }));
                    // Completing from the editor saves the drop set and exits editing mode
                    handleSaveDropSet(set.id);
                  }}
                  unit={exercise?.unit ?? 'kg'}
                  previousWeight={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.weight ?? null}
                  previousReps={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.reps ?? null}
                  maxWeight={maxWeightFor?.(sessionExercise.exerciseId) ?? null}
                />
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs, marginLeft: spacing.md + 16 }}>
                  <TouchableOpacity
                    onPress={() => handleSaveDropSet(set.id)}
                    disabled={createDropSets.isPending || deleteSet.isPending}
                    style={{ flex: 1, backgroundColor: createDropSets.isPending || deleteSet.isPending ? colors.text.muted : colors.accent.primary, borderRadius: borderRadius.sm, paddingVertical: spacing.sm, alignItems: 'center' }}
                  >
                    <Text style={{ color: colors.bg.primary, fontWeight: '700', fontSize: 13 }}>
                      {createDropSets.isPending || deleteSet.isPending ? 'Guardando...' : (dropSetMethod[set.id] ?? 'dropset') === 'dropset' ? 'Guardar Drop Set' : 'Guardar Serie'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleCancelDropSet(set.id)}
                    style={{ flex: 1, backgroundColor: colors.border.primary, borderRadius: borderRadius.sm, paddingVertical: spacing.sm, alignItems: 'center' }}
                  >
                    <Text style={{ color: colors.text.secondary, fontWeight: '600', fontSize: 13 }}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </View>
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
              unit={exercise?.unit ?? 'kg'}
              onUnitChange={handleUnitChange}
              onOpenIntensityPicker={() => handleOpenIntensityPicker(set.id, set)}
              previousWeight={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.weight ?? null}
              previousReps={previousWeightFor?.(sessionExercise.exerciseId, set.setNumber)?.reps ?? null}
              maxWeight={maxWeightFor?.(sessionExercise.exerciseId) ?? null}
            />
          );
        });
      })()
      )}
      {!collapsed && (
      <Button
        title="Add Set"
        variant="secondary"
        compact
        onPress={handleAddSet}
        loading={createSet.isPending}
      />
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
  );
}

function SupersetSetRow({ set, label, unit, previousWeight = null, previousReps = null, maxWeight = null, onUpdate }: {
  set: Set;
  label: string;
  unit: string;
  previousWeight?: number | null;
  previousReps?: number | null;
  maxWeight?: number | null;
  onUpdate: (updates: { reps?: number; weight?: number; completed?: boolean }) => void;
}) {
  const [reps, setReps] = useState(set.reps?.toString() ?? '');
  const [weight, setWeight] = useState(set.weight?.toString() ?? '');

  const weightPlaceholder = () => {
    if (previousWeight == null) return unit;
    if (maxWeight != null) {
      return previousWeight >= maxWeight ? `${previousWeight} ▲` : `${previousWeight} ▼`;
    }
    return String(previousWeight);
  };

  const repsPlaceholder = () => (previousReps != null ? String(previousReps) : 'Reps');

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

function SupersetBlock({ exercises, nameA, nameB, previousWeightFor, maxWeightFor, onSetCompleted, onNewRecord, onDeletePair }: {
  exercises: SessionExercise[];
  nameA: string;
  nameB: string;
  previousWeightFor?: (exerciseId: number, setNumber: number) => { weight: number | null; reps: number | null } | undefined;
  maxWeightFor?: (exerciseId: number) => number | null;
  onSetCompleted?: (exerciseName: string, restTime: number) => void;
  onNewRecord?: (exerciseName: string, weight: number, unit: string) => void;
  onDeletePair?: () => void;
}) {
  const a = exercises[0];
  const b = exercises[1];
  const unlinkSuperSet = useUnlinkSuperSet();
  const createSet = useCreateSet();
  const updateSet = useUpdateSet();
  const deleteSet = useDeleteSet();
  const pairId = a?.supersetPairId;

  // Synchronous mirror of weights just typed in this session, so the new-record
  // comparison never depends on the async react-query refetch of `sets`.
  const pendingWeightsRef = useRef(new Map<number, number>());
  const [collapsed, setCollapsed] = useState(false);

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
  const unitA = exA?.[0]?.unit ?? 'kg';
  const unitB = exB?.[0]?.unit ?? 'kg';

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
    Alert.alert(
      'Eliminar serie',
      'Se elimina la serie de ambos ejercicios.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await haptics.warning();
            if (row.a) {
              await deleteSet.mutateAsync({ id: row.a.id, sessionExerciseId: row.a.sessionExerciseId });
            }
            if (row.b) {
              await deleteSet.mutateAsync({ id: row.b.id, sessionExerciseId: row.b.sessionExerciseId });
            }
          },
        },
      ]
    );
  };

  const handleUnlink = () => {
    if (pairId == null) return;
    Alert.alert(
      'Quitar super set',
      'Se quita la unión entre los ejercicios.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Quitar', style: 'destructive', onPress: () => unlinkSuperSet.mutateAsync(pairId) },
      ]
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
        <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 14 }}>Eliminar</Text>
      </TouchableOpacity>
    );
  };

  return (
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
          Registrá A y luego B: la serie se cierra cuando ambos están ✓
        </Text>
        )}

        {collapsed ? (
        <TouchableOpacity
          onPress={toggleCollapsed}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm, borderRadius: borderRadius.sm, backgroundColor: colors.border.primary }}
        >
          <Text style={{ fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.text.secondary }}>
            {seriesRows.length} {seriesRows.length === 1 ? 'serie' : 'series'} · tocar para expandir
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
              + Agregar serie
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, color: colors.text.muted }}>·</Text>
          <TouchableOpacity onPress={handleUnlink} style={{ paddingVertical: spacing.xs }}>
            <Text style={{ fontSize: 12, color: colors.text.muted }}>Desvincular</Text>
          </TouchableOpacity>
          </>
          )}
        </View>
      </View>
      </Swipeable>
    </Animated.View>
  );
}

function SupersetSeries({ row, nameA, nameB, unitA, unitB, exerciseIdA, exerciseIdB, previousWeightFor, maxWeightFor, onUpdateSet, onDeleteSeries }: {
  row: { setNumber: number; a?: Set; b?: Set };
  nameA: string;
  nameB: string;
  unitA: string;
  unitB: string;
  exerciseIdA: number;
  exerciseIdB: number;
  previousWeightFor?: (exerciseId: number, setNumber: number) => { weight: number | null; reps: number | null } | undefined;
  maxWeightFor?: (exerciseId: number) => number | null;
  onUpdateSet: (set: Set, updates: { reps?: number; weight?: number; completed?: boolean }) => void;
  onDeleteSeries: (row: { setNumber: number; a?: Set; b?: Set }) => void;
}) {
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
        <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 14 }}>Eliminar</Text>
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
            Serie {row.setNumber}
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
            maxWeight={maxA}
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
            maxWeight={maxB}
            onUpdate={(updates) => onUpdateSet(row.b!, updates)}
          />
        ) : null}
      </View>
    </Swipeable>
  );
}
