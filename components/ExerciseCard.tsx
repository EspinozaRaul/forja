import { View, Text } from 'react-native';
import { Badge } from './ui/Badge';
import type { ExerciseWithCategory } from '../lib/types';

interface ExerciseCardProps {
  exercise: ExerciseWithCategory;
}

export function ExerciseCard({ exercise }: ExerciseCardProps) {
  return (
    <View style={{ backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16 }} className="bg-dark-card rounded-2xl p-4">
      <View className="flex-row items-center justify-between">
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF', flex: 1 }} className="text-base font-semibold text-white flex-1">
          {exercise.name}
        </Text>
        {exercise.category && (
          <Badge label={exercise.category.name} color={exercise.category.color} />
        )}
      </View>
      {exercise.description && (
        <Text style={{ fontSize: 14, color: '#A0A0A0', marginTop: 8 }} className="text-sm text-dark-text-secondary mt-2">{exercise.description}</Text>
      )}
    </View>
  );
}
