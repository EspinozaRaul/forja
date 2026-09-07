import { Stack } from 'expo-router';
import { colors } from '../../lib/theme/tokens';

export default function ProgressLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg.primary },
      }}
    >
      <Stack.Screen name="statistics" />
      <Stack.Screen name="exercises" />
      <Stack.Screen name="exercise-detail/[id]" />
      <Stack.Screen name="routine-compare" />
      <Stack.Screen name="measurements" />
    </Stack>
  );
}
