import { Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSessions } from '../../../lib/hooks/useSessions';
import { SessionCard } from '../../../components/SessionCard';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { AnimatedListItem } from '../../../components/ui/AnimatedListItem';

export default function SessionHistoryScreen() {
  const router = useRouter();
  const { data: sessions, isLoading } = useSessions();

  if (isLoading) {
    return <LoadingSpinner message="Loading session history..." />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 p-4">
        {!sessions || sessions.length === 0 ? (
          <EmptyState
            title="No sessions yet"
            message="Start your first workout session!"
          />
        ) : (
          sessions.map((session, index) => (
            <AnimatedListItem key={session.id} index={index} delay={100}>
              <TouchableOpacity
                onPress={() => router.push(`/session/history/${session.id}`)}
                className="mb-3"
              >
                <SessionCard session={session} />
              </TouchableOpacity>
            </AnimatedListItem>
          ))
        )}
      </ScrollView>
    </View>
  );
}