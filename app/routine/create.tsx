import { Text, View, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useExercises } from '../../lib/hooks/useExercises';
import { useCreateRoutine, useAddExerciseToRoutine } from '../../lib/hooks/useRoutines';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ExercisePicker } from '../../components/ExercisePicker';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import type { Exercise } from '../../lib/types';

interface SelectedExercise {
  exercise: Exercise;
  targetSets: number;
  targetReps: number;
  targetWeight: number;
}

export default function CreateRoutineScreen() {
  const router = useRouter();
  const { data: exercises, isLoading: exercisesLoading } = useExercises();
  const createRoutine = useCreateRoutine();
  const addExerciseToRoutine = useAddExerciseToRoutine();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

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
    setSelectedExercises((prev) => [
      ...prev,
      {
        exercise,
        targetSets: 3,
        targetReps: 10,
        targetWeight: 0,
      },
    ]);
    setShowPicker(false);
  };

  const handleRemoveExercise = (exerciseId: number) => {
    setSelectedExercises((prev) => prev.filter((e) => e.exercise.id !== exerciseId));
  };

  const handleUpdateExercise = (
    exerciseId: number,
    field: 'targetSets' | 'targetReps' | 'targetWeight',
    value: number
  ) => {
    setSelectedExercises((prev) =>
      prev.map((e) =>
        e.exercise.id === exerciseId ? { ...e, [field]: value } : e
      )
    );
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      const routine = await createRoutine.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      // Add exercises to routine
      for (let i = 0; i < selectedExercises.length; i++) {
        const selected = selectedExercises[i];
        await addExerciseToRoutine.mutateAsync({
          routineId: routine[0].id,
          exerciseId: selected.exercise.id,
          order: i + 1,
          targetSets: selected.targetSets,
          targetReps: selected.targetReps,
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
    <ScrollView className="flex-1 bg-white p-4">
      <Text className="text-lg font-semibold text-gray-900 mb-4">Create New Routine</Text>

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
      <View className="mb-4">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-medium text-gray-700">Exercises</Text>
          <Button
            title="Add Exercise"
            variant="secondary"
            onPress={() => setShowPicker(true)}
          />
        </View>

        {selectedExercises.length === 0 ? (
          <View className="bg-gray-50 rounded-lg p-4 items-center">
            <Text className="text-gray-400 text-sm">No exercises added yet</Text>
          </View>
        ) : (
          selectedExercises.map((selected) => (
            <View
              key={selected.exercise.id}
              className="bg-gray-50 rounded-lg p-3 mb-2"
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-base font-medium text-gray-900 flex-1">
                  {selected.exercise.name}
                </Text>
                <Button
                  title="Remove"
                  variant="danger"
                  onPress={() => handleRemoveExercise(selected.exercise.id)}
                  className="py-1 px-2"
                />
              </View>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 mb-1">Sets</Text>
                  <Input
                    keyboardType="numeric"
                    value={selected.targetSets.toString()}
                    onChangeText={(text) =>
                      handleUpdateExercise(
                        selected.exercise.id,
                        'targetSets',
                        parseInt(text) || 0
                      )
                    }
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 mb-1">Reps</Text>
                  <Input
                    keyboardType="numeric"
                    value={selected.targetReps.toString()}
                    onChangeText={(text) =>
                      handleUpdateExercise(
                        selected.exercise.id,
                        'targetReps',
                        parseInt(text) || 0
                      )
                    }
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 mb-1">Weight (kg)</Text>
                  <Input
                    keyboardType="decimal-pad"
                    value={selected.targetWeight.toString()}
                    onChangeText={(text) =>
                      handleUpdateExercise(
                        selected.exercise.id,
                        'targetWeight',
                        parseFloat(text) || 0
                      )
                    }
                  />
                </View>
              </View>
            </View>
          ))
        )}
      </View>

      <Button
        title="Create Routine"
        onPress={handleSubmit}
        loading={createRoutine.isPending || addExerciseToRoutine.isPending}
        disabled={createRoutine.isPending || addExerciseToRoutine.isPending}
      />

      {/* Exercise Picker Modal */}
      <ExercisePicker
        visible={showPicker}
        exercises={exercises ?? []}
        onSelect={handleSelectExercise}
        onClose={() => setShowPicker(false)}
      />
    </ScrollView>
  );
}
