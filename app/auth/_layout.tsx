import { Stack } from 'expo-router';
import { colors, fontWeights, fonts } from '../../lib/theme/tokens';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg.primary },
        headerTintColor: colors.text.primary,
        headerTitleStyle: { color: colors.text.primary, fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.semibold },
        contentStyle: { backgroundColor: colors.bg.primary },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
    </Stack>
  );
}
