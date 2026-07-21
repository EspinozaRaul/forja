import '../global.css';
import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDatabase } from '../lib/hooks/useDatabase';
import { ErrorBoundary } from '../components/ErrorBoundary';

const queryClient = new QueryClient();

function DatabaseInitializer({ children }: { children: React.ReactNode }) {
  const { isReady, error } = useDatabase();

  if (error) {
    console.error('Database initialization failed:', error);
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 p-6">
        <Text className="text-lg font-semibold text-red-600 mb-2">Database Error</Text>
        <Text className="text-sm text-gray-600 text-center">
          Failed to initialize database. Please restart the app.
        </Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-sm text-gray-500 mt-3">Initializing database...</Text>
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <DatabaseInitializer>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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
              name="session/new"
              options={{ title: 'New Session', presentation: 'modal' }}
            />
            <Stack.Screen
              name="session/[id]"
              options={{ title: 'Session' }}
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
        </DatabaseInitializer>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
