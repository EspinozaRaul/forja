import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors } from '../../lib/theme/tokens';

export default function ProgressLayout() {
  const { t } = useTranslation();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg.primary },
        headerTintColor: colors.text.primary,
        headerTitleStyle: { color: colors.text.primary, fontWeight: '600' },
        contentStyle: { backgroundColor: colors.bg.primary },
      }}
    >
      <Stack.Screen
        name="statistics"
        options={{
          title: t('progress.statistics.title'),
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="exercises"
        options={{
          title: t('progress.exercises.title'),
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="exercise-detail/[id]"
        options={{
          title: t('progress.exerciseDetail.title'),
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="routine-compare"
        options={{
          title: t('progress.routineCompare.title'),
          headerShown: true,
        }}
      />
    </Stack>
  );
}
