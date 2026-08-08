import { Text, View, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useSessions, useLastSessionForRoutine } from '../../lib/hooks/useSessions';
import { useRoutines } from '../../lib/hooks/useRoutines';
import { useGlobalStats } from '../../lib/hooks/useGlobalStats';
import { SessionCard } from '../../components/SessionCard';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { AnimatedListItem } from '../../components/ui/AnimatedListItem';
import { colors, spacing, borderRadius } from '../../lib/theme/tokens';

export default function HomeScreen() {
  const router = useRouter();
  const { data: sessions, isLoading: sessionsLoading } = useSessions();
  const { data: routines, isLoading: routinesLoading } = useRoutines();
  const { data: globalStats, isLoading: statsLoading } = useGlobalStats();

  const [selectedRoutineId, setSelectedRoutineId] = useState<number | null>(null);
  const { data: lastSession, isLoading: lastSessionLoading } = useLastSessionForRoutine(selectedRoutineId ?? 0);

  const isLoading = sessionsLoading || routinesLoading || statsLoading;

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
    router.push('/session/new');
  };

  const handleStartRoutineSession = (routineId: number) => {
    router.push(`/session/new?routineId=${routineId}`);
  };

  const handleRoutinePress = (routineId: number) => {
    setSelectedRoutineId(routineId);
  };

  const handleStartFresh = () => {
    if (selectedRoutineId) {
      handleStartRoutineSession(selectedRoutineId);
    }
    setSelectedRoutineId(null);
  };

  const handleContinueLast = () => {
    if (selectedRoutineId) {
      router.push(`/session/new?routineId=${selectedRoutineId}&continueFromLast=true`);
    }
    setSelectedRoutineId(null);
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {/* Stats Dashboard */}
      <View style={{ backgroundColor: colors.bg.card, padding: 20, marginBottom: 12, marginHorizontal: spacing.md, marginTop: spacing.md, borderRadius: borderRadius.lg }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text.primary, marginBottom: spacing.md }}>Stats</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1, backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border.primary }}>
            <Text style={{ fontSize: 11, color: colors.text.muted, marginBottom: 4 }}>Workouts</Text>
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.accent.primary }}>
              {globalStats?.totalWorkouts ?? 0}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border.primary }}>
            <Text style={{ fontSize: 11, color: colors.text.muted, marginBottom: 4 }}>Streak</Text>
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.warning }}>
              {globalStats?.currentStreak ?? 0}d
            </Text>
          </View>
        </View>
        {globalStats?.mostFrequentExercise && (
          <View style={{ marginTop: spacing.sm, backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border.primary }}>
            <Text style={{ fontSize: 11, color: colors.text.muted, marginBottom: 2 }}>Most Frequent</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.primary }}>
              {globalStats.mostFrequentExercise}
            </Text>
          </View>
        )}
      </View>

      {/* Quick Start */}
      <View style={{ backgroundColor: colors.bg.card, padding: 20, marginBottom: 12, marginHorizontal: spacing.md, borderRadius: borderRadius.lg }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text.primary, marginBottom: spacing.md }}>Quick Start</Text>
        <Button title="Start Empty Session" onPress={handleStartEmptySession} />
        {routines && routines.length > 0 && (
          <View style={{ marginTop: spacing.md }}>
            <Text style={{ fontSize: 14, color: colors.text.muted, marginBottom: spacing.sm }}>Or start from routine:</Text>
            {routines.slice(0, 3).map((routine) => (
              <TouchableOpacity
                key={routine.id}
                onPress={() => handleRoutinePress(routine.id)}
                style={{ backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm }}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text.primary }}>{routine.name}</Text>
                {routine.description && (
                  <Text style={{ fontSize: 14, color: colors.text.secondary, marginTop: 4 }}>{routine.description}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Recent Sessions */}
      <View style={{ backgroundColor: colors.bg.card, padding: 20, marginBottom: 24, marginHorizontal: spacing.md, borderRadius: borderRadius.lg }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text.primary, marginBottom: spacing.md }}>Recent Sessions</Text>
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
                style={{ marginBottom: spacing.sm }}
              >
                <SessionCard session={session} />
              </TouchableOpacity>
            </AnimatedListItem>
          ))
        )}
        {recentSessions.length > 0 && (
          <View style={{ marginTop: spacing.sm }}>
            <Button
              title="View All Sessions"
              variant="secondary"
              onPress={() => router.push('/session/history')}
            />
          </View>
        )}
      </View>

      {/* Start Session Modal */}
      <Modal
        visible={selectedRoutineId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedRoutineId(null)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}
          onPress={() => setSelectedRoutineId(null)}
        >
          <Pressable
            style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: colors.border.primary }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text.primary, marginBottom: spacing.md }}>Start Session</Text>
            {lastSessionLoading ? (
              <LoadingSpinner message="Checking last session..." />
            ) : lastSession ? (
              <>
                <Text style={{ fontSize: 14, color: colors.text.secondary, marginBottom: spacing.md }}>
                  You have a previous session for this routine. Want to continue with your last numbers?
                </Text>
                <View style={{ backgroundColor: colors.bg.elevated, borderRadius: borderRadius.sm, padding: spacing.sm, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border.primary }}>
                  <Text style={{ fontSize: 13, color: colors.text.secondary, marginBottom: 4 }}>Last session</Text>
                  {lastSession.exercises?.map((se: any) => (
                    <View key={se.id} style={{ marginBottom: 4 }}>
                      <Text style={{ fontSize: 14, color: colors.text.primary, fontWeight: '600' }}>
                        Exercise {se.order}
                      </Text>
                      {se.sets?.map((s: any) => (
                        <Text key={s.id} style={{ fontSize: 12, color: colors.text.secondary, marginLeft: 8 }}>
                          Set {s.setNumber}: {s.reps ?? '—'} reps × {s.weight ?? '—'} kg
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button title="Start Fresh" variant="secondary" onPress={handleStartFresh} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title="Continue Last" onPress={handleContinueLast} />
                  </View>
                </View>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 14, color: colors.text.secondary, marginBottom: spacing.md }}>
                  No previous session found. Start a fresh session?
                </Text>
                <Button title="Start Session" onPress={handleStartFresh} />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
