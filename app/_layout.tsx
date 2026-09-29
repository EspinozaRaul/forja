import '../global.css';
import '../lib/i18n';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';
import { useDatabase } from '../lib/hooks/useDatabase';
import { useAuth } from '../lib/hooks/useAuth';
import { colors, spacing, fontWeights, fonts } from '../lib/theme/tokens';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { EmptyState } from '../components/ui/EmptyState';
import { Screen } from '../components/ui/Screen';

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';
    // The password reset screen is reached from the emailed recovery link and
    // sets its own session from the tokens in that link, so it must render
    // BEFORE the user is authenticated. It is not under the `auth` segment
    // (the link target must stay `forja://reset-password`), so it needs its own
    // exemption here — otherwise the gate bounces the user to login and the
    // reset can never complete.
    const inPasswordReset = segments[0] === 'reset-password';

    if (!user && !inAuthGroup && !inPasswordReset) {
      // Not logged in, redirect to login
      router.replace('/auth/login');
    } else if (user && inAuthGroup) {
      // Logged in but on auth screen, redirect to main app
      router.replace('/(tabs)');
    }

    setIsReady(true);
  }, [user, loading, segments]);

  if (loading || !isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg.primary }}>
        <ActivityIndicator size="large" color={colors.accent.primary} />
        <Text style={{ color: colors.text.muted, marginTop: spacing.md }}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg.primary },
        headerTintColor: colors.text.primary,
        headerTitleStyle: { color: colors.text.primary, fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.semibold },
        contentStyle: { backgroundColor: colors.bg.primary },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen
        name="reset-password"
        options={{ title: t('auth.resetPassword.title'), headerShown: false }}
      />
      <Stack.Screen
        name="exercise/create"
        options={{ title: t('exercise.create.title'), presentation: 'modal' }}
      />
      <Stack.Screen
        name="exercise/[id]"
        options={{ title: t('exercise.detail.title') }}
      />
      <Stack.Screen
        name="routine/create"
        options={{ title: t('routine.create.title'), presentation: 'modal' }}
      />
      <Stack.Screen
        name="routine/[id]"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: t('settings.title'),
        }}
      />
      <Stack.Screen
        name="routine/folder/[id]"
        options={{ title: t('routine.folder.title'), headerShown: false }}
      />
      <Stack.Screen
        name="session/new"
        options={{ title: t('session.create.title'), presentation: 'modal' }}
      />
      <Stack.Screen
        name="session/[id]"
        options={{ title: t('session.title'), headerShown: false }}
      />
      <Stack.Screen
        name="session/history/[id]"
        options={{ title: t('session.history.summary') }}
      />
      <Stack.Screen
        name="session/history"
        options={{ title: t('session.history.title') }}
      />
      <Stack.Screen
        name="progress"
        options={{ headerShown: false }}
      />

    </Stack>
  );
}

function DatabaseInitializer({ children }: { children: React.ReactNode }) {
  const { isReady, error } = useDatabase();
  const { t } = useTranslation();

  if (error) {
    // `useDatabase` reports the failure and logs it in every build; this branch only
    // renders it. The root is `<Screen>` so the message clears the status bar and the
    // device insets, and `EmptyState` keeps it in the app's one failure look instead of
    // growing a second one. It was a bare `View` with `className` before, and className
    // is inert here: the message rendered at the top-left, on the Android window
    // background, underneath the status bar.
    return (
      <Screen>
        <EmptyState
          icon={<Ionicons name="alert-circle-outline" size={48} color={colors.error} />}
          title={t('common.databaseError')}
          message={t('common.databaseInitFailed')}
        />
      </Screen>
    );
  }

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.primary }}>
        <Image 
          source={require('../assets/splash-icon.png')} 
          style={{ width: 120, height: 120, resizeMode: 'contain' }}
        />
      </View>
    );
  }

  return <>{children}</>;
}

function FontInitializer({ children }: { children: React.ReactNode }) {
  const [fontsLoaded, fontError] = useFonts({
    Oswald_600SemiBold: require('../assets/fonts/Oswald-SemiBold.ttf'),
    SpaceGrotesk_400Regular: require('../assets/fonts/SpaceGrotesk-Regular.ttf'),
    SpaceGrotesk_500Medium: require('../assets/fonts/SpaceGrotesk-Medium.ttf'),
    SpaceGrotesk_600SemiBold: require('../assets/fonts/SpaceGrotesk-SemiBold.ttf'),
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg.primary }}>
        <ActivityIndicator size="large" color={colors.accent.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            <QueryClientProvider client={queryClient}>
              <I18nextProvider i18n={i18n}>
                <FontInitializer>
                  <DatabaseInitializer>
                    <RootLayoutNav />
                  </DatabaseInitializer>
                </FontInitializer>
              </I18nextProvider>
            </QueryClientProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
