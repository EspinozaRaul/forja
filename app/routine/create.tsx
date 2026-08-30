import { Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts } from '../../lib/theme/tokens';
import { useExercises } from '../../lib/hooks/useExercises';
import { useLastWeightByExerciseIds } from '../../lib/hooks/useExercises';
import { useCreateRoutine, useAddExerciseToRoutine } from '../../lib/hooks/useRoutines';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ExercisePicker } from '../../components/ExercisePicker';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useSettings } from '../../lib/utils/settings';
import { resolveUnit, formatWeight } from '../../lib/utils/weight-unit';
import { getExerciseName } from '../../lib/utils/exercise-names';
import type { Exercise } from '../../lib/types';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../../lib/hooks/useConfirmDialog';

export default function CreateRoutineScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { dialog, showAlert } = useConfirmDialog();
  const params = useLocalSearchParams<{ folderId?: string }>();
  const folderId = params.folderId ? Number(params.folderId) : undefined;

  const { data: exercises, isLoading: exercisesLoading } = useExercises();
  const createRoutine = useCreateRoutine();
  const addExerciseToRoutine = useAddExerciseToRoutine();
  const settings = useSettings();
  const settingsUnit = settings.data.weightUnit;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerState, setPickerState] = useState({ search: '', selectedMuscle: 'Todos', selectedIds: [] as number[] });
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const lastWeights = useLastWeightByExerciseIds(selectedExercises.map((e) => e.id));

  const validate = () => {
    const newErrors: { name?: string } = {};
    if (!name.trim()) {
      newErrors.name = t('routine.create.nameRequired');
    } else if (name.trim().length < 2) {
      newErrors.name = t('routine.create.nameMinLength');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSelectExercise = (exercise: Exercise) => {
    setSelectedExercises((prev) => [...prev, exercise]);
    setShowPicker(false);
  };

  const handleMultiSelectExercises = (exercises: Exercise[]) => {
    setSelectedExercises((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      const newOnes = exercises.filter((e) => !existingIds.has(e.id));
      return [...prev, ...newOnes];
    });
    setShowPicker(false);
  };

  const handleRemoveExercise = (exerciseId: number) => {
    setSelectedExercises((prev) => prev.filter((e) => e.id !== exerciseId));
    setDragIndex(null);
  };

  const handleDragHandleTap = (index: number) => {
    if (dragIndex === null) {
      // First tap — select this exercise
      setDragIndex(index);
    } else if (dragIndex === index) {
      // Tap same — deselect
      setDragIndex(null);
    } else {
      // Second tap — swap positions
      setSelectedExercises((prev) => {
        const next = [...prev];
        const temp = next[dragIndex];
        next[dragIndex] = next[index];
        next[index] = temp;
        return next;
      });
      setDragIndex(null);
    }
  };

  const handleReplaceExercise = (exercise: Exercise) => {
    if (replaceIndex === null) return;
    setSelectedExercises((prev) => {
      const next = [...prev];
      next[replaceIndex] = exercise;
      return next;
    });
    setReplaceIndex(null);
    setShowPicker(false);
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      const routine = await createRoutine.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        folderId,
      });

      for (let i = 0; i < selectedExercises.length; i++) {
        const exercise = selectedExercises[i];
        await addExerciseToRoutine.mutateAsync({
          routineId: routine[0].id,
          exerciseId: exercise.id,
          order: i + 1,
        });
      }

      router.back();
    } catch (error) {
      showAlert(t('common.error'), t('routine.create.createFailed'));
    }
  };

  if (exercisesLoading) {
    return <LoadingSpinner message={t('routine.create.loading')} />;
  }

  return (
    <>
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg.primary, padding: spacing.md }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md }}>{t('routine.create.title')}</Text>

      <Input
        label={t('routine.create.nameLabel')}
        placeholder={t('routine.create.namePlaceholder')}
        value={name}
        onChangeText={setName}
        error={errors.name}
      />

      <Input
        label={t('routine.create.descriptionLabel')}
        placeholder={t('routine.create.descriptionPlaceholder')}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
      />

      {/* Selected Exercises */}
      <View style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text style={{ fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text.secondary }}>{t('routine.create.exercises')}</Text>
          <Button title={t('routine.create.addExercise')} variant="secondary" onPress={() => setShowPicker(true)} />
        </View>

        {dragIndex !== null && (
          <View style={{ backgroundColor: colors.bg.active, borderRadius: borderRadius.sm, padding: spacing.sm + spacing.xs, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.accent.primary }}>
            <Text style={{ fontSize: 12, color: colors.accent.primary, textAlign: 'center' }}>
              {t('routine.create.tapToSwap')}
            </Text>
          </View>
        )}

        {selectedExercises.length === 0 ? (
          <View style={{ backgroundColor: colors.bg.elevated, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center' }}>
            <Text style={{ color: colors.text.muted, fontSize: 14, fontFamily: fonts.body }}>{t('routine.create.noExercises')}</Text>
          </View>
        ) : (
          selectedExercises.map((exercise, index) => (
            <Animated.View
              key={exercise.id}
              layout={LinearTransition.duration(200)}
            >
              <View
                style={{
                  backgroundColor: dragIndex === index ? colors.bg.active : colors.bg.card,
                  borderRadius: borderRadius.md,
                  paddingHorizontal: spacing.sm + spacing.xs,
                  paddingVertical: spacing.sm + spacing.xs,
                  marginBottom: spacing.sm,
                  borderWidth: 1,
                  borderColor: dragIndex === index ? colors.accent.primary : colors.border.primary,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
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
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text.muted, width: 20 }}>{index + 1}</Text>
                <Text style={{ fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text.primary, flex: 1 }} numberOfLines={1}>
                  {getExerciseName(exercise.name, i18n.language)}
                </Text>
                {lastWeights.data?.[exercise.id] != null && (
                  <Text style={{ fontSize: 12, fontFamily: fonts.body, color: colors.accent.secondary }}>
                    {t('routine.create.lastWeight')}: {formatWeight(lastWeights.data?.[exercise.id]?.weight, resolveUnit(lastWeights.data?.[exercise.id]?.unit, settingsUnit))}
                  </Text>
                )}
                <TouchableOpacity
                  onPress={() => { setReplaceIndex(index); setShowPicker(true); }}
                  style={{ paddingLeft: spacing.sm }}
                >
                  <Text style={{ fontSize: 14, color: colors.accent.primary }}>↻</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleRemoveExercise(exercise.id)} style={{ paddingLeft: spacing.sm }}>
                  <Text style={{ fontSize: 16, color: colors.error }}>✕</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          ))
        )}
      </View>

      <Button
        title={t('routine.create.submit')}
        onPress={handleSubmit}
        loading={createRoutine.isPending || addExerciseToRoutine.isPending}
        disabled={createRoutine.isPending || addExerciseToRoutine.isPending}
      />

      <ExercisePicker
        visible={showPicker}
        exercises={exercises ?? []}
        onSelect={replaceIndex !== null ? handleReplaceExercise : handleSelectExercise}
        onMultiSelect={handleMultiSelectExercises}
        onClose={() => { setShowPicker(false); setReplaceIndex(null); }}
        mode={replaceIndex === null ? 'multi' : 'single'}
        state={pickerState}
        onStateChange={setPickerState}
      />

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
    </ScrollView>
    </>
  );
}
