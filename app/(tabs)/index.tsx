import { Text, View, ScrollView, TouchableOpacity, Modal, Pressable, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useSessions } from '../../lib/hooks/useSessions';
import { useRoutines, useRoutineExercises } from '../../lib/hooks/useRoutines';
import { useExercises, useLastWeightByExerciseIds } from '../../lib/hooks/useExercises';
import { useCreateSession, useAddExerciseToSession } from '../../lib/hooks/useSessions';
import { useGlobalStats } from '../../lib/hooks/useGlobalStats';
import { SessionCard } from '../../components/SessionCard';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { AnimatedListItem } from '../../components/ui/AnimatedListItem';
import { colors, spacing, borderRadius, fonts } from '../../lib/theme/tokens';
import { haptics } from '../../lib/utils/haptics';
import { EXERCISE_NAMES_ES } from '../../lib/db/exercise-names-es';

export default function HomeScreen() {
  const router = useRouter();
  const { data: sessions, isLoading: sessionsLoading } = useSessions();
  const { data: routines, isLoading: routinesLoading } = useRoutines();
  const { data: globalStats, isLoading: statsLoading } = useGlobalStats();

  const [selectedRoutineId, setSelectedRoutineId] = useState<number | null>(null);
  const { data: routineExercises, isLoading: exercisesLoading } = useRoutineExercises(selectedRoutineId ?? 0);
  const { data: allExercises } = useExercises();
  const lastWeights = useLastWeightByExerciseIds(routineExercises?.map((re) => re.exerciseId) ?? []);
  const createSession = useCreateSession();
  const addExerciseToSession = useAddExerciseToSession();

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

  const handleRoutinePress = (routineId: number) => {
    setSelectedRoutineId(routineId);
  };

  const handleStartRoutineSession = async () => {
    if (!selectedRoutineId) return;
    try {
      await haptics.success();
      const session = await createSession.mutateAsync({
        routineId: selectedRoutineId,
      });

      // Copy routine exercises to the new session (fresh start)
      if (routineExercises && routineExercises.length > 0) {
        for (const re of routineExercises) {
          await addExerciseToSession.mutateAsync({
            sessionId: session[0].id,
            exerciseId: re.exerciseId,
            order: re.order,
          });
        }
      }

      setSelectedRoutineId(null);
      router.push(`/session/${session[0].id}`);
    } catch (error) {
      await haptics.error();
      Alert.alert('Error', 'Failed to create session');
    }
  };

  const selectedRoutine = routines?.find((r) => r.id === selectedRoutineId);

  const routineExercisesWithDetails = routineExercises
    ?.map((re) => {
      const exercise = allExercises?.find((e) => e.id === re.exerciseId);
      return { ...re, exercise };
    })
    ?.sort((a, b) => a.order - b.order) ?? [];

  if (isLoading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {/* Stats Dashboard */}
      <View style={{ backgroundColor: colors.bg.card, padding: spacing.md + spacing.xs, marginBottom: 12, marginHorizontal: spacing.md, marginTop: spacing.md, borderRadius: borderRadius.lg }}>
        <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md }}>Stats</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1, backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border.primary }}>
            <Text style={{ fontSize: 11, fontFamily: fonts.bodyMedium, color: colors.text.muted, marginBottom: 4 }}>Workouts</Text>
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.accent.primary }}>
              {globalStats?.totalWorkouts ?? 0}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border.primary }}>
            <Text style={{ fontSize: 11, fontFamily: fonts.bodyMedium, color: colors.text.muted, marginBottom: 4 }}>Streak</Text>
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.warning }}>
              {globalStats?.currentStreak ?? 0}d
            </Text>
          </View>
        </View>
        {globalStats?.mostFrequentExercise && (
          <View style={{ marginTop: spacing.sm, backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border.primary }}>
            <Text style={{ fontSize: 11, fontFamily: fonts.bodyMedium, color: colors.text.muted, marginBottom: 2 }}>Most Frequent</Text>
            <Text style={{ fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
              {globalStats.mostFrequentExercise}
            </Text>
          </View>
        )}
      </View>

      {/* Quick Start */}
      <View style={{ backgroundColor: colors.bg.card, padding: spacing.md + spacing.xs, marginBottom: 12, marginHorizontal: spacing.md, borderRadius: borderRadius.lg }}>
        <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md }}>Quick Start</Text>
        <Button title="Start Empty Session" onPress={handleStartEmptySession} />
        {routines && routines.length > 0 && (
          <View style={{ marginTop: spacing.md }}>
            <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.muted, marginBottom: spacing.sm }}>Or start from routine:</Text>
            {routines.slice(0, 3).map((routine) => (
              <TouchableOpacity
                key={routine.id}
                onPress={() => handleRoutinePress(routine.id)}
                style={{ backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm }}
              >
                <Text style={{ fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>{routine.name}</Text>
                {routine.description && (
                  <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.secondary, marginTop: 4 }}>{routine.description}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Recent Sessions */}
      <View style={{ backgroundColor: colors.bg.card, padding: spacing.md + spacing.xs, marginBottom: 24, marginHorizontal: spacing.md, borderRadius: borderRadius.lg }}>
        <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md }}>Recent Sessions</Text>
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

      {/* Routine Preview Modal */}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary, flex: 1 }}>
                {selectedRoutine?.name ?? 'Start Session'}
              </Text>
              <TouchableOpacity onPress={() => setSelectedRoutineId(null)} style={{ padding: spacing.xs }}>
                <Text style={{ fontSize: 18, color: colors.text.muted }}>✕</Text>
              </TouchableOpacity>
            </View>
            {selectedRoutine?.description && (
              <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.secondary, marginBottom: spacing.sm }}>{selectedRoutine.description}</Text>
            )}
            {exercisesLoading ? (
              <LoadingSpinner message="Loading exercises..." />
            ) : (
              <>
                {routineExercisesWithDetails.length === 0 ? (
                  <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.secondary, marginBottom: spacing.md }}>
                    No exercises in this routine yet.
                  </Text>
                ) : (
                  <View style={{ marginBottom: spacing.md }}>
                    {routineExercisesWithDetails.map((re) => (
                      <View key={re.id} style={{ backgroundColor: colors.bg.elevated, borderRadius: borderRadius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, marginBottom: 3, borderWidth: 1, borderColor: colors.border.primary }}>
                        <Text style={{ fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
                          {re.exercise ? (EXERCISE_NAMES_ES[re.exercise.name] || re.exercise.name) : 'Ejercicio desconocido'}
                        </Text>
                        <Text style={{ fontSize: 12, fontFamily: fonts.body, color: colors.text.secondary, marginTop: 1 }}>
                          {re.targetSets ?? 3} sets × {re.targetReps ?? 10} reps
                          {re.exercise && lastWeights.data?.[re.exercise.id] != null
                            ? ` · último: ${lastWeights.data?.[re.exercise.id]?.weight}${lastWeights.data?.[re.exercise.id]?.unit ?? 'kg'}`
                            : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                <Button title="Start Session" onPress={handleStartRoutineSession} loading={createSession.isPending} />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
