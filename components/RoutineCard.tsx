import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Badge } from './ui/Badge';
import { colors, spacing, borderRadius, fonts, fontSizes } from '../lib/theme/tokens';
import type { RoutineWithExercises } from '../lib/types';

interface RoutineCardProps {
  routine: RoutineWithExercises;
}

export function RoutineCard({ routine }: RoutineCardProps) {
  const { t } = useTranslation();
  const exerciseCount = routine.exercises.length;

  return (
    <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: fontSizes.lg, color: colors.text.primary, flex: 1 }}>
          {routine.name}
        </Text>
        <Badge
          label={`${exerciseCount} ${exerciseCount === 1 ? t('routine.exercise') : t('routine.exercises')}`}
          color={colors.accent.primary}
        />
      </View>
      {routine.description && (
        <Text style={{ fontFamily: fonts.body, fontSize: fontSizes.md, color: colors.text.secondary, marginTop: spacing.sm }}>{routine.description}</Text>
      )}
    </View>
  );
}
