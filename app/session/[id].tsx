import { Text, View, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSession, useSessionExercises, useCompleteSession, useAddExerciseToSession } from '../../lib/hooks/useSessions';
import { useExercise, useExercises } from '../../lib/hooks/useExercises';
import { useSets, useCreateSet, useUpdateSet } from '../../lib/hooks/useSets';
import { Timer } from '../../components/Timer';
import { SetLogger } from '../../components/SetLogger';
import { Button } from '../../components/ui/Button';
import { ExercisePicker } from '../../components/ExercisePicker';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { haptics } from '../../lib/utils/haptics';
import type { SessionExercise, Set } from '../../lib/types';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const sessionId = parseInt(id, 10);

  const { data: sessions, isLoading: sessionLoading } = useSession(sessionId);
  const { data: sessionExercises, isLoading: exercisesLoading } = useSessionExercises(sessionId);
  const completeSession = useCompleteSession();
  const addExerciseToSession = useAddExerciseToSession();
  const { data: allExercises } = useExercises();

  const session = sessions?.[0];
  const isLoading = sessionLoading || exercisesLoading;

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showPicker, setShowPicker] = useState(false);

  if (isLoading) {
    return <LoadingSpinner message="Loading session..." />;
  }

  if (!session) {
    return (
      <View className="flex-1 bg-white p-4">
        <EmptyState title="Session not found" />
      </View>
    );
  }

  const handleEndSession = async () => {
    Alert.alert(
      'End Session',
      'Are you sure you want to end this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'End Session', 
          style: 'destructive',
          onPress: async () => {
            try {
              await haptics.heavy();
              await completeSession.mutateAsync({
                id: sessionId,
                data: {
                  duration: elapsedSeconds,
                },
              });
              router.push(`/session/history/${sessionId}`);
            } catch (error) {
              await haptics.error();
              Alert.alert('Error', 'Failed to end session');
            }
          }
        },
      ]
    );
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

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Timer */}
      <View className="bg-white p-4 border-b border-gray-200">
        <Timer onTimeUpdate={setElapsedSeconds} />
      </View>

      {/* Exercises */}
      <View className="bg-white p-4 border-t border-gray-200">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg font-semibold text-gray-900">Exercises</Text>
          <Button
            title="Add Exercise"
            variant="secondary"
            onPress={() => setShowPicker(true)}
          />
        </View>

        {!sessionExercises || sessionExercises.length === 0 ? (
          <EmptyState
            title="No exercises"
            message="Add exercises to this session."
          />
        ) : (
          sessionExercises.map((se) => (
            <SessionExerciseItem
              key={se.id}
              sessionExercise={se}
            />
          ))
        )}
      </View>

      {/* End Session Button */}
      <View className="p-4 bg-white border-t border-gray-200">
        <Button
          title="End Session"
          variant="danger"
          onPress={handleEndSession}
          loading={completeSession.isPending}
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

function SessionExerciseItem({ sessionExercise }: { sessionExercise: SessionExercise }) {
  const { data: exercises } = useExercise(sessionExercise.exerciseId);
  const { data: sets } = useSets(sessionExercise.id);
  const createSet = useCreateSet();
  const updateSet = useUpdateSet();

  const exercise = exercises?.[0];

  const handleAddSet = async () => {
    await haptics.press();
    const nextSetNumber = (sets?.length ?? 0) + 1;
    await createSet.mutateAsync({
      sessionExerciseId: sessionExercise.id,
      setNumber: nextSetNumber,
    });
  };

  const handleUpdateSet = async (set: Set, updates: { reps?: number; weight?: number; completed?: boolean }) => {
    if (updates.completed && !set.completed) {
      await haptics.complete();
    }
    await updateSet.mutateAsync({
      id: set.id,
      data: updates,
    });
  };

  return (
    <View className="mb-4">
      <Text className="text-base font-semibold text-gray-900 mb-2">
        {exercise?.name ?? 'Unknown Exercise'}
      </Text>
      {sets?.map((set) => (
        <SetLogger
          key={set.id}
          set={set}
          onUpdate={(updates) => handleUpdateSet(set, updates)}
        />
      ))}
      <Button
        title="Add Set"
        variant="secondary"
        onPress={handleAddSet}
        loading={createSet.isPending}
        className="mt-2"
      />
    </View>
  );
}
