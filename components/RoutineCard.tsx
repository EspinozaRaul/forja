import { View, Text } from 'react-native';
import { Badge } from './ui/Badge';
import type { RoutineWithExercises } from '../lib/types';

interface RoutineCardProps {
  routine: RoutineWithExercises;
}

export function RoutineCard({ routine }: RoutineCardProps) {
  const exerciseCount = routine.exercises.length;

  return (
    <View className="bg-white rounded-lg p-4 shadow-sm">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-gray-900 flex-1">
          {routine.name}
        </Text>
        <Badge
          label={`${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}`}
          color="#6B7280"
        />
      </View>
      {routine.description && (
        <Text className="text-sm text-gray-500 mt-1">{routine.description}</Text>
      )}
    </View>
  );
}
