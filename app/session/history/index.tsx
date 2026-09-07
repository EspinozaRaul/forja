import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, spacing } from '../../../lib/theme/tokens';
import { useSessions } from '../../../lib/hooks/useSessions';
import { SessionCard } from '../../../components/SessionCard';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { AnimatedListItem } from '../../../components/ui/AnimatedListItem';

export default function SessionHistoryScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: sessions, isLoading } = useSessions();

  if (isLoading) {
    return <LoadingSpinner message={t('session.history.loadingMessage')} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <ScrollView style={{ flex: 1, padding: spacing.md }}>
        {!sessions || sessions.length === 0 ? (
          <EmptyState
            title={t('tabs.home.noSessions')}
            message={t('tabs.home.noSessionsMessage')}
          />
        ) : (
          sessions.map((session, index) => (
            <AnimatedListItem key={session.id} index={index} delay={100}>
              <TouchableOpacity
                onPress={() => router.push(`/session/history/${session.id}`)}
                style={{ marginBottom: spacing.sm }}
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