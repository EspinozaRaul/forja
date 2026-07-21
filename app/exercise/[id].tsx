import { Text, View, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useExercise } from '../../lib/hooks/useExercises';
import { useExerciseHistory } from '../../lib/hooks/useExercises';
import { useTotalVolumeByWeek } from '../../lib/hooks/useProgress';
import { ProgressChart } from '../../components/ProgressChart';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Button } from '../../components/ui/Button';

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const exerciseId = parseInt(id, 10);

  const { data: exercises, isLoading: exerciseLoading } = useExercise(exerciseId);
  const { data: history, isLoading: historyLoading } = useExerciseHistory(exerciseId);
  const { data: volumeData, isLoading: volumeLoading } = useTotalVolumeByWeek(exerciseId);

  const exercise = exercises?.[0];
  const isLoading = exerciseLoading || historyLoading || volumeLoading;

  if (isLoading) {
    return <LoadingSpinner message="Loading exercise..." />;
  }

  if (!exercise) {
    return (
      <View className="flex-1 bg-white p-4">
        <EmptyState title="Exercise not found" />
      </View>
    );
  }

  // Group history by session
  const groupedBySession = history?.reduce((acc, set) => {
    if (!acc[set.sessionId]) {
      acc[set.sessionId] = [];
    }
    acc[set.sessionId].push(set);
    return acc;
  }, {} as Record<number, typeof history>) ?? {};

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Exercise Info */}
      <View className="bg-white p-4 border-b border-gray-200">
        <Text className="text-xl font-bold text-gray-900">{exercise.name}</Text>
        {exercise.description && (
          <Text className="text-gray-500 mt-1">{exercise.description}</Text>
        )}
      </View>

      {/* Progress Chart */}
      <View className="p-4">
        <ProgressChart
          data={volumeData ?? []}
          title="Weekly Volume (kg)"
          unit="kg"
        />
      </View>

      {/* History */}
      <View className="bg-white p-4 border-t border-gray-200">
        <Text className="text-lg font-semibold text-gray-900 mb-3">Set History</Text>
        {Object.keys(groupedBySession).length === 0 ? (
          <EmptyState
            title="No sets logged"
            message="Start a session to log sets for this exercise."
          />
        ) : (
          Object.entries(groupedBySession).map(([sessionId, sets]) => (
            <View key={sessionId} className="mb-4">
              <Text className="text-sm font-medium text-gray-500 mb-2">
                Session #{sessionId}
              </Text>
              {sets.map((set) => (
                <View key={set.id} className="flex-row justify-between py-1 border-b border-gray-100">
                  <Text className="text-sm text-gray-600">Set {set.setNumber}</Text>
                  <Text className="text-sm text-gray-900">
                    {set.reps ?? '-'} reps × {set.weight ?? '-'} kg
                  </Text>
                  <Text className={`text-sm ${set.completed ? 'text-green-500' : 'text-gray-400'}`}>
                    {set.completed ? '✓' : '○'}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
