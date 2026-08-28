import '../global.css';
import '../lib/i18n';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { I18nextProvider } from 'react-i18next';
import i18n from '../lib/i18n';
import { useDatabase } from '../lib/hooks/useDatabase';
import { repairRoutineTargetDefaults } from '../lib/db/queries';
import { useAuth } from '../lib/hooks/useAuth';
import { colors } from '../lib/theme/tokens';

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);

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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#141210' }}>
        <ActivityIndicator size="large" color={colors.accent.primary} />
        <Text style={{ color: '#7A7265', marginTop: 16 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#141210' },
        headerTintColor: '#F2ECE2',
        headerTitleStyle: { color: '#F2ECE2', fontWeight: '600' },
        contentStyle: { backgroundColor: '#141210' },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen
        name="exercise/create"
        options={{ title: 'New Exercise', presentation: 'modal' }}
      />
      <Stack.Screen
        name="exercise/[id]"
        options={{ title: 'Exercise' }}
      />
      <Stack.Screen
        name="routine/create"
        options={{ title: 'New Routine', presentation: 'modal' }}
      />
      <Stack.Screen
        name="routine/[id]"
        options={{ title: 'Routine' }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          headerStyle: { backgroundColor: '#141210' },
          headerTintColor: '#F2ECE2',
          headerTitleStyle: { color: '#F2ECE2', fontWeight: '600' },
        }}
      />
      <Stack.Screen
        name="routine/folder/[id]"
        options={{ title: 'Folder', headerShown: false }}
      />
      <Stack.Screen
        name="session/new"
        options={{ title: 'New Session', presentation: 'modal' }}
      />
      <Stack.Screen
        name="session/[id]"
        options={{ title: 'Session', headerShown: false }}
      />
      <Stack.Screen
        name="session/history/[id]"
        options={{ title: 'Session Summary' }}
      />
      <Stack.Screen
        name="session/history"
        options={{ title: 'Session History' }}
      />
    </Stack>
  );
}

function DatabaseInitializer({ children }: { children: React.ReactNode }) {
  const { isReady, error } = useDatabase();

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
        <Text className="text-lg font-semibold text-error mb-2">Database Error</Text>
        <Text className="text-sm text-dark-text-secondary text-center">
          Failed to initialize database. Please restart the app.
        </Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View className="flex-1 items-center justify-center bg-dark-bg">
        <ActivityIndicator size="large" color={colors.accent.primary} />
        <Text className="text-sm text-dark-text-secondary mt-4">Initializing database...</Text>
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
