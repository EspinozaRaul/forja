import { View, Text } from 'react-native';
import { Badge } from './ui/Badge';
import type { ExerciseWithCategory } from '../lib/types';

interface ExerciseCardProps {
  exercise: ExerciseWithCategory;
}

export function ExerciseCard({ exercise }: ExerciseCardProps) {
  return (
    <View className="bg-white rounded-lg p-4 shadow-sm">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-gray-900 flex-1">
          {exercise.name}
        </Text>
        {exercise.category && (
          <Badge label={exercise.category.name} color={exercise.category.color} />
        )}
      </View>
      {exercise.description && (
        <Text className="text-sm text-gray-500 mt-1">{exercise.description}</Text>
      )}
    </View>
  );
}
