import { View, Text } from 'react-native';
import { Badge } from './ui/Badge';
import { colors, spacing, borderRadius, fonts } from '../lib/theme/tokens';
import type { ExerciseWithCategory } from '../lib/types';

interface ExerciseCardProps {
  exercise: ExerciseWithCategory;
}

export function ExerciseCard({ exercise }: ExerciseCardProps) {
  return (
    <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.text.primary, flex: 1 }}>
          {exercise.name}
        </Text>
        {exercise.category && (
          <Badge label={exercise.category.name} color={exercise.category.color} />
        )}
      </View>
      {exercise.description && (
        <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.secondary, marginTop: spacing.sm }}>{exercise.description}</Text>
      )}
    </View>
  );
}
