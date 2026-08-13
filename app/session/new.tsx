import { Text, View, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCreateSession, useAddExerciseToSession, useLastSessionForRoutine, useDuplicateSessionData } from '../../lib/hooks/useSessions';
import { useRoutine, useRoutineExercises } from '../../lib/hooks/useRoutines';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { colors, spacing, borderRadius, fonts } from '../../lib/theme/tokens';
import { haptics } from '../../lib/utils/haptics';

export default function NewSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { routineId, continueFromLast } = useLocalSearchParams<{ routineId?: string; continueFromLast?: string }>();
  const createSession = useCreateSession();

  const routineIdNum = routineId ? parseInt(routineId, 10) : undefined;
  const { data: routines, isLoading: routineLoading } = useRoutine(routineIdNum ?? 0);
  const { data: routineExercises, isLoading: exercisesLoading } = useRoutineExercises(routineIdNum ?? 0);
  const addExerciseToSession = useAddExerciseToSession();
  const { data: lastSession, isLoading: lastSessionLoading } = useLastSessionForRoutine(routineIdNum ?? 0);
  const duplicateSessionData = useDuplicateSessionData();

  const routine = routines?.[0];
  const isLoading = routineIdNum ? (routineLoading || exercisesLoading) : false;
  const shouldContinue = continueFromLast === 'true' && !!lastSession;

  const handleStartSession = async () => {
    try {
      await haptics.success();
      const session = await createSession.mutateAsync({
        routineId: routineIdNum,
      });

      if (shouldContinue && lastSession) {
        // Duplicate exercises and sets from last session
        await duplicateSessionData.mutateAsync({
          sourceSessionId: lastSession.id,
          targetSessionId: session[0].id,
        });
      } else if (routineExercises && routineExercises.length > 0) {
        // Copy routine exercises to the new session (fresh start)
        for (const re of routineExercises) {
          await addExerciseToSession.mutateAsync({
            sessionId: session[0].id,
            exerciseId: re.exerciseId,
            order: re.order,
          });
        }
      }

      router.replace(`/session/${session[0].id}`);
    } catch (error) {
      await haptics.error();
      Alert.alert('Error', 'Failed to create session');
    }
  };

  if (isLoading || (shouldContinue && lastSessionLoading)) {
    return <LoadingSpinner message="Loading routine..." />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary, padding: spacing.md, paddingBottom: insets.bottom + spacing.md }} className="flex-1 bg-dark-bg p-4">
      <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md }} className="text-lg font-semibold text-dark-text-primary mb-4">Start New Session</Text>
      
      {routine ? (
        <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.sm, padding: spacing.md, marginBottom: spacing.md }} className="bg-dark-card rounded-lg p-4 mb-4">
          <Text style={{ fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.text.primary }} className="text-base font-medium text-dark-text-primary">{routine.name}</Text>
          {routine.description && (
            <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.secondary, marginTop: spacing.xs }} className="text-sm text-dark-text-secondary mt-1">{routine.description}</Text>
          )}
          {shouldContinue && lastSession ? (
            <View style={{ marginTop: spacing.sm }}>
              <Text style={{ fontSize: 14, color: colors.accent.primary, fontFamily: fonts.bodyMedium }}>Continuing from last session</Text>
              {lastSession.exercises?.map((se: any) => (
                <View key={se.id} style={{ marginTop: spacing.xs, marginLeft: spacing.sm }}>
                  <Text style={{ fontSize: 13, fontFamily: fonts.body, color: colors.text.secondary }}>Exercise {se.order}</Text>
                  {se.sets?.map((s: any) => (
                    <Text key={s.id} style={{ fontSize: 12, fontFamily: fonts.body, color: colors.text.secondary, marginLeft: spacing.sm }}>
                      Set {s.setNumber}: {s.reps ?? '—'} reps × {s.weight ?? '—'} kg
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.secondary, marginTop: spacing.sm }} className="text-sm text-dark-text-secondary mt-2">
              {routineExercises?.length ?? 0} exercises
            </Text>
          )}
        </View>
      ) : (
        <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.sm, padding: spacing.md, marginBottom: spacing.md }} className="bg-dark-card rounded-lg p-4 mb-4">
          <Text style={{ fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.text.primary }} className="text-base font-medium text-dark-text-primary">Empty Session</Text>
          <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.secondary, marginTop: spacing.xs }} className="text-sm text-dark-text-secondary mt-1">
            You can add exercises during the session.
          </Text>
        </View>
      )}

      <Button
        title="Start Session"
        onPress={handleStartSession}
        loading={createSession.isPending}
      />
    </View>
  );
}