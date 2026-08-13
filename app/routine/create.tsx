import { Text, View, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { colors, spacing, borderRadius, fonts } from '../../lib/theme/tokens';
import { useExercises } from '../../lib/hooks/useExercises';
import { useCreateRoutine, useAddExerciseToRoutine } from '../../lib/hooks/useRoutines';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ExercisePicker } from '../../components/ExercisePicker';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EXERCISE_NAMES_ES } from '../../lib/db/exercise-names-es';
import type { Exercise } from '../../lib/types';

export default function CreateRoutineScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ folderId?: string }>();
  const folderId = params.folderId ? Number(params.folderId) : undefined;

  const { data: exercises, isLoading: exercisesLoading } = useExercises();
  const createRoutine = useCreateRoutine();
  const addExerciseToRoutine = useAddExerciseToRoutine();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<Exercise[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);

  const validate = () => {
    const newErrors: { name?: string } = {};
    if (!name.trim()) {
      newErrors.name = 'Routine name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Routine name must be at least 2 characters';
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
      Alert.alert('Error', 'Failed to create routine. Please try again.');
    }
  };

  if (exercisesLoading) {
    return <LoadingSpinner message="Loading exercises..." />;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg.primary, padding: spacing.md }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md }}>Create New Routine</Text>

      <Input
        label="Routine Name"
        placeholder="e.g., Push Day"
        value={name}
        onChangeText={setName}
        error={errors.name}
      />

      <Input
        label="Description (optional)"
        placeholder="e.g., Chest, shoulders, triceps"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
      />

      {/* Selected Exercises */}
      <View style={{ marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text style={{ fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text.secondary }}>Exercises</Text>
          <Button title="Add Exercise" variant="secondary" onPress={() => setShowPicker(true)} />
        </View>

        {dragIndex !== null && (
          <View style={{ backgroundColor: colors.bg.active, borderRadius: borderRadius.sm, padding: spacing.sm + spacing.xs, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.accent.primary }}>
            <Text style={{ fontSize: 12, color: colors.accent.primary, textAlign: 'center' }}>
              Tap another exercise to swap positions — or tap the same to cancel
            </Text>
          </View>
        )}

        {selectedExercises.length === 0 ? (
          <View style={{ backgroundColor: colors.bg.elevated, borderRadius: borderRadius.sm, padding: spacing.md, alignItems: 'center' }}>
            <Text style={{ color: colors.text.muted, fontSize: 14, fontFamily: fonts.body }}>No exercises added yet</Text>
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
                  {EXERCISE_NAMES_ES[exercise.name] || exercise.name}
                </Text>
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
        title="Create Routine"
        onPress={handleSubmit}
        loading={createRoutine.isPending || addExerciseToRoutine.isPending}
        disabled={createRoutine.isPending || addExerciseToRoutine.isPending}
      />

      <ExercisePicker
        visible={showPicker}
        exercises={exercises ?? []}
        onSelect={replaceIndex !== null ? handleReplaceExercise : handleSelectExercise}
        onMultiSelect={handleMultiSelectExercises}
        onPreview={(exercise) => {
          setShowPicker(false);
          router.push(`/exercise/${exercise.id}`);
        }}
        onClose={() => { setShowPicker(false); setReplaceIndex(null); }}
        multiSelect={replaceIndex === null}
      />
    </ScrollView>
  );
}
