import { Text, View, ScrollView, Modal, Pressable, TouchableOpacity } from 'react-native';
import { useState, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts } from '../../lib/theme/tokens';
import { useRoutine, useRoutineExercises, useUpdateRoutine, useAddExerciseToRoutine, useRemoveExerciseFromRoutine, useDeleteRoutine, useUpdateRoutineExerciseOrder, useReplaceRoutineExercise } from '../../lib/hooks/useRoutines';
import { useExercises, useLastWorkoutPerExercise } from '../../lib/hooks/useExercises';
import { useCreateSession, useAddExerciseToSession, useLastSessionForRoutine, useDuplicateSessionData } from '../../lib/hooks/useSessions';
import { useCreateSet } from '../../lib/hooks/useSets';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ExercisePicker } from '../../components/ExercisePicker';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { haptics } from '../../lib/utils/haptics';
import { useSettings } from '../../lib/utils/settings';
import { resolveUnit, formatWeight } from '../../lib/utils/weight-unit';
import { getExerciseName } from '../../lib/utils/exercise-names';
import { DEFAULT_TARGET_SETS, DEFAULT_TARGET_REPS, formatSetsRepsLabel } from '../../lib/constants/routine-defaults';
import { summarizeSets } from '../../lib/utils/session-summary';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../../lib/hooks/useConfirmDialog';

export default function RoutineDetailScreen() {
  const { t, i18n } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const routineId = parseInt(id, 10);

  if (isNaN(routineId)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, padding: spacing.md }}>
        <EmptyState title={t('common.error')} message="Invalid routine ID" />
      </View>
    );
  }

  const { data: routines, isLoading: routineLoading } = useRoutine(routineId);
  const { data: routineExercises, isLoading: exercisesLoading } = useRoutineExercises(routineId);
  const { data: allExercises, isLoading: allExercisesLoading } = useExercises();
  const lastWorkout = useLastWorkoutPerExercise(routineExercises?.map((re) => re.exerciseId) ?? []);
  const updateRoutine = useUpdateRoutine();
  const addExerciseToRoutine = useAddExerciseToRoutine();
  const removeExerciseFromRoutine = useRemoveExerciseFromRoutine();
  const deleteRoutine = useDeleteRoutine();
  const updateOrder = useUpdateRoutineExerciseOrder();
  const createSession = useCreateSession();
  const addExerciseToSession = useAddExerciseToSession();
  const createSet = useCreateSet();
  const { data: lastSession } = useLastSessionForRoutine(routineId);
  const duplicateSessionData = useDuplicateSessionData();
  const settings = useSettings();
  const settingsUnit = settings.data.weightUnit;

  const routine = routines?.[0];
  const isLoading = routineLoading || exercisesLoading || allExercisesLoading;

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [pickerState, setPickerState] = useState({ search: '', selectedMuscle: t('exercise.picker.allMuscles'), selectedIds: [] as number[] });
  const [showStartModal, setShowStartModal] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const replaceExercise = useReplaceRoutineExercise();
  const { dialog, showAlert, showConfirm } = useConfirmDialog();

  const routineExercisesWithDetails = useMemo(() => {
    if (!routineExercises) return [];
    const exerciseMap = new Map(allExercises?.map((e) => [e.id, e]) ?? []);
    return routineExercises
      .map((re) => ({ ...re, exercise: exerciseMap.get(re.exerciseId) }))
      .sort((a, b) => a.order - b.order);
  }, [routineExercises, allExercises]);

  const handleStartEdit = () => {
    if (routine) {
      setEditName(routine.name);
      setEditDescription(routine.description ?? '');
      setIsEditing(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      showAlert(t('common.error'), t('routine.detail.nameRequired'));
      return;
    }
    try {
      await updateRoutine.mutateAsync({
        id: routineId,
        data: { name: editName.trim(), description: editDescription.trim() || undefined },
      });
      setIsEditing(false);
    } catch (error) {
      showAlert(t('common.error'), t('routine.detail.updateFailed'));
    }
  };

  const handleAddExercise = async (exercise: { id: number }) => {
    try {
      await addExerciseToRoutine.mutateAsync({
        routineId,
        exerciseId: exercise.id,
        order: routineExercisesWithDetails.length + 1,
        targetSets: DEFAULT_TARGET_SETS,
        targetReps: DEFAULT_TARGET_REPS,
      });
      setShowPicker(false);
    } catch (error) {
      showAlert(t('common.error'), t('routine.detail.addExerciseFailed'));
    }
  };

  const handleMultiAddExercises = async (exercises: { id: number }[]) => {
    try {
      for (let i = 0; i < exercises.length; i++) {
        await addExerciseToRoutine.mutateAsync({
          routineId,
          exerciseId: exercises[i].id,
          order: routineExercisesWithDetails.length + i + 1,
          targetSets: DEFAULT_TARGET_SETS,
          targetReps: DEFAULT_TARGET_REPS,
        });
      }
      setShowPicker(false);
    } catch (error) {
      showAlert(t('common.error'), t('routine.detail.addExercisesFailed'));
    }
  };

  const handleDragHandleTap = async (index: number) => {
    if (dragIndex === null) {
      setDragIndex(index);
    } else if (dragIndex === index) {
      setDragIndex(null);
    } else {
      // Swap and persist
      const target = routineExercisesWithDetails[index];
      const source = routineExercisesWithDetails[dragIndex];
      if (!target || !source) return;
      
      try {
        await updateOrder.mutateAsync({ id: target.id, order: dragIndex + 1 });
        await updateOrder.mutateAsync({ id: source.id, order: index + 1 });
      } catch (error) {
        showAlert(t('common.error'), t('routine.detail.reorderFailed'));
      }
      setDragIndex(null);
    }
  };

  const handleReplaceExercise = async (exercise: { id: number }) => {
    if (replaceIndex === null) return;
    const target = routineExercisesWithDetails[replaceIndex];
    if (!target) return;
    
    try {
      await replaceExercise.mutateAsync({ id: target.id, exerciseId: exercise.id });
    } catch (error) {
      showAlert(t('common.error'), t('routine.detail.replaceFailed'));
    }
    setReplaceIndex(null);
    setShowPicker(false);
  };

  const handleRemoveExercise = async (routineExerciseId: number) => {
    showConfirm(
      t('routine.detail.removeExerciseTitle'),
      t('routine.detail.removeExerciseMessage'),
      async () => {
        try {
          await haptics.warning();
          await removeExerciseFromRoutine.mutateAsync(routineExerciseId);
          setDragIndex(null);
        } catch (error) {
          await haptics.error();
          showAlert(t('common.error'), t('routine.detail.removeExerciseFailed'));
        }
      },
      { confirmLabel: t('routine.detail.remove'), destructive: true }
    );
  };

  const handleDeleteRoutine = async () => {
    showConfirm(
      t('routine.detail.deleteRoutineTitle'),
      t('routine.detail.deleteRoutineMessage'),
      async () => {
        try {
          await haptics.warning();
          await deleteRoutine.mutateAsync(routineId);
          router.back();
        } catch (error) {
          await haptics.error();
          showAlert(t('common.error'), t('routine.detail.deleteRoutineFailed'));
        }
      },
      { confirmLabel: t('common.delete'), destructive: true }
    );
  };

  const handleStartSession = async (continueFromLast: boolean = false) => {
    try {
      await haptics.success();
      const session = await createSession.mutateAsync({ routineId });

      if (continueFromLast && lastSession) {
        await duplicateSessionData.mutateAsync({
          sourceSessionId: lastSession.id,
          targetSessionId: session[0].id,
        });
      } else {
        for (const re of routineExercisesWithDetails) {
          const se = await addExerciseToSession.mutateAsync({
            sessionId: session[0].id,
            exerciseId: re.exerciseId,
            order: re.order,
          });
          // Materialize the planned set template (empty sets guide the user)
          const sessionExerciseId = se[0].id;
          const plannedSets = re.targetSets ?? DEFAULT_TARGET_SETS;
          for (let i = 1; i <= plannedSets; i++) {
            await createSet.mutateAsync({
              sessionExerciseId,
              setNumber: i,
            });
          }
        }
      }

      router.push(`/session/${session[0].id}`);
    } catch (error) {
      await haptics.error();
      showAlert(t('common.error'), t('routine.detail.startSessionFailed'));
    }
  };

  const handleStartPress = () => {
    if (lastSession) {
      setShowStartModal(true);
    } else {
      handleStartSession(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message={t('routine.detail.loading')} />;
  }

  if (!routine) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, padding: spacing.md }}>
        <EmptyState title={t('routine.detail.notFound')} />
      </View>
    );
  }

  return (
    <>
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {/* Routine Info */}
      <View style={{ backgroundColor: colors.bg.card, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border.primary }}>
        {isEditing ? (
          <>
            <Input label={t('routine.detail.nameLabel')} value={editName} onChangeText={setEditName} placeholder={t('routine.detail.namePlaceholder')} />
            <Input label={t('routine.detail.descriptionLabel')} value={editDescription} onChangeText={setEditDescription} placeholder={t('routine.detail.descriptionPlaceholder')} multiline />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title={t('common.save')} onPress={handleSaveEdit} loading={updateRoutine.isPending} />
              <Button title={t('common.cancel')} variant="secondary" onPress={() => setIsEditing(false)} />
            </View>
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={{ fontSize: 20, fontFamily: fonts.bodySemiBold, color: colors.text.primary, flex: 1 }}>{routine.name}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button title={t('common.edit')} variant="secondary" onPress={handleStartEdit} />
                <Button title={t('common.delete')} variant="danger" onPress={handleDeleteRoutine} />
              </View>
            </View>
            {routine.description && (
              <Text style={{ color: colors.text.secondary, fontFamily: fonts.body, marginBottom: spacing.sm + spacing.xs }}>{routine.description}</Text>
            )}
          </>
        )}
      </View>

      {/* Exercises List */}
      <View style={{ backgroundColor: colors.bg.card, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm + spacing.xs }}>
          <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>{t('routine.detail.exercises')}</Text>
          <Button title={t('routine.detail.addExercise')} variant="secondary" onPress={() => setShowPicker(true)} />
        </View>

        {dragIndex !== null && (
          <View style={{ backgroundColor: colors.bg.active, borderRadius: borderRadius.sm, padding: spacing.sm + spacing.xs, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.accent.primary }}>
            <Text style={{ fontSize: 12, color: colors.accent.primary, textAlign: 'center' }}>
              {t('routine.detail.tapToSwap')}
            </Text>
          </View>
        )}

        {routineExercisesWithDetails.length === 0 ? (
          <EmptyState title={t('routine.detail.noExercises')} message={t('routine.detail.noExercisesMessage')} />
        ) : (
          routineExercisesWithDetails.map((re, index) => (
            <Animated.View
              key={re.id}
              layout={LinearTransition.duration(200)}
            >
              <View
                style={{
                  backgroundColor: dragIndex === index ? colors.bg.active : colors.bg.elevated,
                  borderRadius: borderRadius.sm,
                  padding: spacing.sm + spacing.xs,
                  marginBottom: spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  borderWidth: 1,
                  borderColor: dragIndex === index ? colors.accent.primary : 'transparent',
                }}
              >
                <TouchableOpacity
                  onPress={() => handleDragHandleTap(index)}
                  activeOpacity={0.7}
                  style={{ gap: 3, paddingRight: spacing.sm, borderRightWidth: 1, borderRightColor: colors.border.divider }}
                >
                  <View style={{ width: 16, height: 2, backgroundColor: dragIndex === index ? colors.accent.primary : colors.text.muted, borderRadius: 1 }} />
                  <View style={{ width: 16, height: 2, backgroundColor: dragIndex === index ? colors.accent.primary : colors.text.muted, borderRadius: 1 }} />
                  <View style={{ width: 16, height: 2, backgroundColor: dragIndex === index ? colors.accent.primary : colors.text.muted, borderRadius: 1 }} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); re.exercise && router.push(`/exercise/${re.exercise.id}`); }}
                  style={{ flex: 1 }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
                    {re.exercise ? getExerciseName(re.exercise.name, i18n.language) : t('routine.detail.unknownExercise')}
                  </Text>
                  <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.secondary, marginTop: spacing.xs }}>
                    {(() => {
                      const entry = re.exercise ? lastWorkout.data?.[re.exercise.id] : undefined;
                      return entry
                        ? `${entry.sets} sets${entry.reps != null ? ` × ${entry.reps} reps` : ''}${entry.weight != null ? ` · último: ${formatWeight(entry.weight, resolveUnit(entry.unit, settingsUnit))}` : ''}`
                        : formatSetsRepsLabel(re.targetSets, re.targetReps);
                    })()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); setReplaceIndex(index); setShowPicker(true); }}
                  style={{ padding: spacing.sm }}
                >
                  <Text style={{ fontSize: 14, color: colors.accent.primary }}>↻</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); handleRemoveExercise(re.id); }}
                  style={{ padding: spacing.sm }}
                >
                  <Text style={{ fontSize: 16, color: colors.error }}>✕</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          ))
        )}
      </View>

      {/* Start Session Button */}
      <View style={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.bg.card, borderTopWidth: 1, borderTopColor: colors.border.primary }}>
        <Button
          title={t('routine.detail.startSession')}
          onPress={handleStartPress}
          loading={createSession.isPending}
          disabled={routineExercisesWithDetails.length === 0}
        />
      </View>

      <ExercisePicker
        visible={showPicker}
        exercises={allExercises ?? []}
        onSelect={replaceIndex !== null ? handleReplaceExercise : handleAddExercise}
        onMultiSelect={handleMultiAddExercises}
        onClose={() => { setShowPicker(false); setReplaceIndex(null); }}
        multiSelect={replaceIndex === null}
        state={pickerState}
        onStateChange={setPickerState}
      />

      <Modal visible={showStartModal} transparent animationType="fade" onRequestClose={() => setShowStartModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }} onPress={() => setShowStartModal(false)}>
          <Pressable style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: colors.border.primary }} onPress={(e) => e.stopPropagation()}>
            <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md }}>{t('routine.detail.startSession')}</Text>
            <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.secondary, marginBottom: spacing.md }}>
              {t('routine.detail.previousSessionMessage')}
            </Text>
            {lastSession && (
              <View style={{ backgroundColor: colors.bg.elevated, borderRadius: borderRadius.sm, padding: spacing.sm + spacing.xs, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border.primary }}>
                <Text style={{ fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.text.secondary, marginBottom: spacing.xs }}>{t('routine.detail.lastSession')}</Text>
                {lastSession.exercises?.map((se) => {
                  const unit = resolveUnit(
                    allExercises?.find((e) => e.id === se.exerciseId)?.unit ?? null,
                    settingsUnit
                  );
                  return (
                  <View key={se.id} style={{ marginBottom: spacing.xs }}>
                    <Text style={{ fontSize: 14, color: colors.text.primary, fontFamily: fonts.bodySemiBold }}>{getExerciseName(se.exerciseName ?? '', i18n.language) || se.exerciseName || t('routine.detail.exerciseNumber', { order: se.order })}</Text>
                    {summarizeSets(se.sets ?? []).map((line) => (
                      line.type === 'group' ? (
                        <Text key={`${se.id}-g-${line.setNumber}`} style={{ fontSize: 12, color: colors.accent.primary, fontFamily: fonts.bodyMedium, marginLeft: spacing.sm }}>
                          {line.label} × {line.count}
                        </Text>
                      ) : (
                        <Text key={`${se.id}-s-${line.setNumber}`} style={{ fontSize: 12, color: colors.text.secondary, fontFamily: fonts.body, marginLeft: spacing.sm }}>
                          Set {line.setNumber}: {line.reps ?? '—'} reps × {line.weight != null ? formatWeight(line.weight, unit) : '—'}
                        </Text>
                      )
                    ))}
                  </View>
                  );
                })}
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title={t('routine.detail.startFresh')} variant="secondary" onPress={() => { setShowStartModal(false); handleStartSession(false); }} />
              <Button title={t('routine.detail.continueLast')} onPress={() => { setShowStartModal(false); handleStartSession(true); }} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
    <ConfirmDialog
      visible={dialog.visible}
      title={dialog.title}
      message={dialog.message}
      confirmLabel={dialog.confirmLabel}
      cancelLabel={dialog.cancelLabel}
      destructive={dialog.destructive}
      onConfirm={dialog.onConfirm}
      onCancel={dialog.onCancel}
    />
    </>
  );
}
