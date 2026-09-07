import '../global.css';
import '../lib/i18n';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, Image } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { I18nextProvider, useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';
import { useDatabase } from '../lib/hooks/useDatabase';
import { repairRoutineTargetDefaults } from '../lib/db/queries';
import { useAuth } from '../lib/hooks/useAuth';
import { colors, spacing , fontWeights} from '../lib/theme/tokens';

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!user && !inAuthGroup) {
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
        headerTitleStyle: { color: colors.text.primary, fontWeight: fontWeights.semibold },
        contentStyle: { backgroundColor: colors.bg.primary },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
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
        options={{ title: t('routine.detail.title') }}
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
        name="progress/statistics"
        options={{ title: t('progress.statistics.title'), headerShown: false }}
      />
      <Stack.Screen
        name="progress/exercises"
        options={{ title: t('progress.exercises.title'), headerShown: false }}
      />
      <Stack.Screen
        name="progress/exercise-detail/[id]"
        options={{ title: t('progress.exerciseDetail.title'), headerShown: false }}
      />
      <Stack.Screen
        name="progress/routine-compare"
        options={{ title: t('progress.routineCompare.title'), headerShown: false }}
      />
      <Stack.Screen
        name="progress/measurements"
        options={{ title: t('progress.measurements.title'), headerShown: false }}
      />
    </Stack>
  );
}

function DatabaseInitializer({ children }: { children: React.ReactNode }) {
  const { isReady, error } = useDatabase();
  const { t } = useTranslation();

  // Transient one-time data fix: clean up routine_exercises rows corrupted by
  // the partial-session upsync bug (target_sets = 1, null/0 targets broke the
  // Home preview). Fire-and-forget once the DB is ready; the [isReady]
  // dependency guarantees it does not re-run on every render.
  useEffect(() => {
    if (!isReady) return;
    repairRoutineTargetDefaults().catch((err) => {
      console.error('Failed to repair routine target defaults:', err);
    });
  }, [isReady]);

  if (error) {
    console.error('Database initialization failed:', error);
    return (
      <View className="flex-1 items-center justify-center bg-dark-bg p-6">
        <Text className="text-lg font-semibold text-error mb-2">{t('common.databaseError')}</Text>
        <Text className="text-sm text-dark-text-secondary text-center">
          {t('common.databaseInitFailed')}
        </Text>
      </View>
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
      <View className="flex-1 items-center justify-center bg-dark-bg">
        <ActivityIndicator size="large" color={colors.accent.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
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
  );
}
