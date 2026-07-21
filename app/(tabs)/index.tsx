import { Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSessions } from '../../lib/hooks/useSessions';
import { useRoutines } from '../../lib/hooks/useRoutines';
import { SessionCard } from '../../components/SessionCard';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { AnimatedListItem } from '../../components/ui/AnimatedListItem';

export default function HomeScreen() {
  const router = useRouter();
  const { data: sessions, isLoading: sessionsLoading } = useSessions();
  const { data: routines, isLoading: routinesLoading } = useRoutines();

  const isLoading = sessionsLoading || routinesLoading;

  // Stats
  const totalSessions = sessions?.length ?? 0;
  const thisWeekSessions = sessions?.filter((s) => {
    const now = new Date();
    const sessionDate = new Date(s.startedAt);
    const diffDays = (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  }).length ?? 0;

  // Recent sessions (last 5)
  const recentSessions = sessions?.slice(0, 5) ?? [];

  const handleStartEmptySession = async () => {
    // TODO: create session and navigate
    router.push('/session/new');
  };

  const handleStartRoutineSession = (routineId: number) => {
    router.push(`/session/new?routineId=${routineId}`);
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Stats Summary */}
      <View className="bg-white p-4 mb-2">
        <Text className="text-lg font-semibold text-gray-900 mb-3">This Week</Text>
        <View className="flex-row justify-between">
          <View className="items-center flex-1">
            <Text className="text-2xl font-bold text-blue-500">{thisWeekSessions}</Text>
            <Text className="text-sm text-gray-500">Sessions</Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-2xl font-bold text-green-500">{totalSessions}</Text>
            <Text className="text-sm text-gray-500">Total Sessions</Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-2xl font-bold text-purple-500">{routines?.length ?? 0}</Text>
            <Text className="text-sm text-gray-500">Routines</Text>
          </View>
        </View>
      </View>

      {/* Quick Start */}
      <View className="bg-white p-4 mb-2">
        <Text className="text-lg font-semibold text-gray-900 mb-3">Quick Start</Text>
        <Button title="Start Empty Session" onPress={handleStartEmptySession} />
        {routines && routines.length > 0 && (
          <View className="mt-3">
            <Text className="text-sm font-medium text-gray-600 mb-2">Or start from routine:</Text>
            {routines.slice(0, 3).map((routine) => (
              <TouchableOpacity
                key={routine.id}
                onPress={() => handleStartRoutineSession(routine.id)}
                className="bg-gray-100 rounded-lg p-3 mb-2"
              >
                <Text className="text-base font-medium text-gray-900">{routine.name}</Text>
                {routine.description && (
                  <Text className="text-sm text-gray-500">{routine.description}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Recent Sessions */}
      <View className="bg-white p-4 mb-2">
        <Text className="text-lg font-semibold text-gray-900 mb-3">Recent Sessions</Text>
        {recentSessions.length === 0 ? (
          <EmptyState
            title="No sessions yet"
            message="Start your first workout session!"
          />
        ) : (
          recentSessions.map((session, index) => (
            <AnimatedListItem key={session.id} index={index} delay={100}>
              <TouchableOpacity
                onPress={() => router.push(`/session/history/${session.id}`)}
                className="mb-2"
              >
                <SessionCard session={session} />
              </TouchableOpacity>
            </AnimatedListItem>
          ))
        )}
        {recentSessions.length > 0 && (
          <Button
            title="View All Sessions"
            variant="secondary"
            onPress={() => router.push('/session/history')}
          />
        )}
      </View>
    </ScrollView>
  );
}
