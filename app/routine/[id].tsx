import { Text, View, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRoutine, useRoutineExercises, useUpdateRoutine, useAddExerciseToRoutine, useRemoveExerciseFromRoutine } from '../../lib/hooks/useRoutines';
import { useExercises } from '../../lib/hooks/useExercises';
import { useCreateSession } from '../../lib/hooks/useSessions';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ExercisePicker } from '../../components/ExercisePicker';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { haptics } from '../../lib/utils/haptics';

export default function RoutineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const routineId = parseInt(id, 10);

  const { data: routines, isLoading: routineLoading } = useRoutine(routineId);
  const { data: routineExercises, isLoading: exercisesLoading } = useRoutineExercises(routineId);
  const { data: allExercises, isLoading: allExercisesLoading } = useExercises();
  const updateRoutine = useUpdateRoutine();
  const addExerciseToRoutine = useAddExerciseToRoutine();
  const removeExerciseFromRoutine = useRemoveExerciseFromRoutine();
  const createSession = useCreateSession();

  const routine = routines?.[0];
  const isLoading = routineLoading || exercisesLoading || allExercisesLoading;

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  // Map routine exercises to include exercise details
  const routineExercisesWithDetails = routineExercises?.map((re) => {
    const exercise = allExercises?.find((e) => e.id === re.exerciseId);
    return { ...re, exercise };
  }) ?? [];

  const handleStartEdit = () => {
    if (routine) {
      setEditName(routine.name);
      setEditDescription(routine.description ?? '');
      setIsEditing(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    try {
      await updateRoutine.mutateAsync({
        id: routineId,
        data: {
          name: editName.trim(),
          description: editDescription.trim() || undefined,
        },
      });
      setIsEditing(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update routine');
    }
  };

  const handleAddExercise = async (exercise: { id: number }) => {
    try {
      await addExerciseToRoutine.mutateAsync({
        routineId,
        exerciseId: exercise.id,
        order: routineExercisesWithDetails.length + 1,
        targetSets: 3,
        targetReps: 10,
      });
      setShowPicker(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to add exercise');
    }
  };

  const handleRemoveExercise = async (routineExerciseId: number) => {
    Alert.alert(
      'Remove Exercise',
      'Are you sure you want to remove this exercise from the routine?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            try {
              await haptics.warning();
              await removeExerciseFromRoutine.mutateAsync(routineExerciseId);
            } catch (error) {
              await haptics.error();
              Alert.alert('Error', 'Failed to remove exercise');
            }
          }
        },
      ]
    );
  };

  const handleStartSession = async () => {
    try {
      await haptics.success();
      const session = await createSession.mutateAsync({ routineId });
      router.push(`/session/${session[0].id}`);
    } catch (error) {
      await haptics.error();
      Alert.alert('Error', 'Failed to start session');
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading routine..." />;
  }

  if (!routine) {
    return (
      <View className="flex-1 bg-white p-4">
        <EmptyState title="Routine not found" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Routine Info */}
      <View className="bg-white p-4 border-b border-gray-200">
        {isEditing ? (
          <>
            <Input
              label="Routine Name"
              value={editName}
              onChangeText={setEditName}
              placeholder="Routine name"
            />
            <Input
              label="Description"
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Description (optional)"
              multiline
            />
            <View className="flex-row gap-2">
              <Button
                title="Save"
                onPress={handleSaveEdit}
                loading={updateRoutine.isPending}
                className="flex-1"
              />
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setIsEditing(false)}
                className="flex-1"
              />
            </View>
          </>
        ) : (
          <>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-xl font-bold text-gray-900 flex-1">{routine.name}</Text>
              <Button title="Edit" variant="secondary" onPress={handleStartEdit} />
            </View>
            {routine.description && (
              <Text className="text-gray-500 mb-3">{routine.description}</Text>
            )}
          </>
        )}
      </View>

      {/* Exercises List */}
      <View className="bg-white p-4 border-t border-gray-200">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg font-semibold text-gray-900">Exercises</Text>
          <Button
            title="Add Exercise"
            variant="secondary"
            onPress={() => setShowPicker(true)}
          />
        </View>

        {routineExercisesWithDetails.length === 0 ? (
          <EmptyState
            title="No exercises"
            message="Add exercises to this routine."
          />
        ) : (
          routineExercisesWithDetails.map((re) => (
            <View
              key={re.id}
              className="bg-gray-50 rounded-lg p-3 mb-2 flex-row items-center justify-between"
            >
              <View className="flex-1">
                <Text className="text-base font-medium text-gray-900">
                  {re.exercise?.name ?? 'Unknown Exercise'}
                </Text>
                <Text className="text-sm text-gray-500">
                  {re.targetSets ?? 3} sets × {re.targetReps ?? 10} reps
                </Text>
              </View>
              <Button
                title="Remove"
                variant="danger"
                onPress={() => handleRemoveExercise(re.id)}
                className="py-1 px-2"
              />
            </View>
          ))
        )}
      </View>

      {/* Start Session Button */}
      <View className="p-4 bg-white border-t border-gray-200">
        <Button
          title="Start Session"
          onPress={handleStartSession}
          loading={createSession.isPending}
          disabled={routineExercisesWithDetails.length === 0}
        />
      </View>

      {/* Exercise Picker Modal */}
      <ExercisePicker
        visible={showPicker}
        exercises={allExercises ?? []}
        onSelect={handleAddExercise}
        onClose={() => setShowPicker(false)}
      />
    </ScrollView>
  );
}
