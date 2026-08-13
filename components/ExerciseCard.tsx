import { View, Text } from 'react-native';
import { Badge } from './ui/Badge';
import { colors, spacing, borderRadius, fonts } from '../lib/theme/tokens';
import type { ExerciseWithCategory } from '../lib/types';

interface ExerciseCardProps {
  exercise: ExerciseWithCategory;
}

export function ExerciseCard({ exercise }: ExerciseCardProps) {
  return (
    <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md }} className="bg-dark-card rounded-2xl p-4">
      <View className="flex-row items-center justify-between">
        <Text style={{ fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.text.primary, flex: 1 }} className="text-base font-semibold text-white flex-1">
          {exercise.name}
        </Text>
        {exercise.category && (
          <Badge label={exercise.category.name} color={exercise.category.color} />
        )}
      </View>
      {exercise.description && (
        <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.secondary, marginTop: spacing.sm }} className="text-sm text-dark-text-secondary mt-2">{exercise.description}</Text>
      )}
    </View>
  );
}
