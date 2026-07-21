import { Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useRoutines } from '../../lib/hooks/useRoutines';
import { useRoutineExercises } from '../../lib/hooks/useRoutines';
import { RoutineCard } from '../../components/RoutineCard';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { AnimatedListItem } from '../../components/ui/AnimatedListItem';
import type { RoutineWithExercises } from '../../lib/types';

export default function RoutinesScreen() {
  const router = useRouter();
  const { data: routines, isLoading } = useRoutines();

  // We need to fetch exercises for each routine to show count
  // For simplicity, we'll just show routine name and description
  // The RoutineCard expects RoutineWithExercises, but we don't have exercises loaded
  // Let's create a simpler card for now

  if (isLoading) {
    return <LoadingSpinner message="Loading routines..." />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white p-4 border-b border-gray-200">
        <Text className="text-lg font-semibold text-gray-900">Your Routines</Text>
      </View>

      {/* Routine List */}
      <ScrollView className="flex-1 p-4">
        {!routines || routines.length === 0 ? (
          <EmptyState
            title="No routines yet"
            message="Create a routine to organize your exercises."
          />
        ) : (
          routines.map((routine, index) => (
            <AnimatedListItem key={routine.id} index={index} delay={100}>
              <TouchableOpacity
                onPress={() => router.push(`/routine/${routine.id}`)}
                className="mb-3"
              >
                <View className="bg-white rounded-lg p-4 shadow-sm">
                  <Text className="text-base font-semibold text-gray-900">{routine.name}</Text>
                  {routine.description && (
                    <Text className="text-sm text-gray-500 mt-1">{routine.description}</Text>
                  )}
                </View>
              </TouchableOpacity>
            </AnimatedListItem>
          ))
        )}
      </ScrollView>

      {/* Create Routine Button */}
      <View className="p-4 bg-white border-t border-gray-200">
        <Button title="Create New Routine" onPress={() => router.push('/routine/create')} />
      </View>
    </View>
  );
}
