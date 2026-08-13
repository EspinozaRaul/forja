import { View, Text } from 'react-native';
import { Badge } from './ui/Badge';
import { colors, fonts } from '../lib/theme/tokens';
import type { RoutineWithExercises } from '../lib/types';

interface RoutineCardProps {
  routine: RoutineWithExercises;
}

export function RoutineCard({ routine }: RoutineCardProps) {
  const exerciseCount = routine.exercises.length;

  return (
    <View className="bg-dark-card rounded-2xl p-4">
      <View className="flex-row items-center justify-between">
        <Text style={{ fontFamily: fonts.bodySemiBold }} className="text-base font-semibold text-white flex-1">
          {routine.name}
        </Text>
        <Badge
          label={`${exerciseCount} exercise${exerciseCount !== 1 ? 's' : ''}`}
          color={colors.accent.primary}
        />
      </View>
      {routine.description && (
        <Text style={{ fontFamily: fonts.body }} className="text-sm text-dark-text-secondary mt-2">{routine.description}</Text>
      )}
    </View>
  );
}
