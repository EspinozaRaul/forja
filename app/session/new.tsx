import { Text, View, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCreateSession, useAddExerciseToSession, useLastSessionForRoutine } from '../../lib/hooks/useSessions';
import { useCreateSet } from '../../lib/hooks/useSets';
import { useRoutine, useRoutineExercises } from '../../lib/hooks/useRoutines';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { colors, spacing, borderRadius, fonts } from '../../lib/theme/tokens';
import { haptics } from '../../lib/utils/haptics';
import { DEFAULT_TARGET_SETS } from '../../lib/constants/routine-defaults';

export default function NewSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { routineId } = useLocalSearchParams<{ routineId?: string }>();
  const createSession = useCreateSession();

  const routineIdNum = routineId ? parseInt(routineId, 10) : undefined;
  const { data: routines, isLoading: routineLoading } = useRoutine(routineIdNum ?? 0);
  const { data: routineExercises, isLoading: exercisesLoading } = useRoutineExercises(routineIdNum ?? 0);
  const { data: lastSession } = useLastSessionForRoutine(routineIdNum ?? 0);
  const addExerciseToSession = useAddExerciseToSession();
  const createSet = useCreateSet();

  const routine = routines?.[0];
  const isLoading = routineIdNum ? (routineLoading || exercisesLoading) : false;

  const handleStartSession = async () => {
    try {
      await haptics.success();
      const session = await createSession.mutateAsync({
        routineId: routineIdNum,
      });

      if (routineExercises && routineExercises.length > 0) {
        // Copy routine exercises to the new session (fresh start) and
        // materialize the planned set template (empty sets guide the user)
        // Also copy notes from the last session (seat height, pain notes, etc.)
        for (const re of routineExercises) {
          const se = await addExerciseToSession.mutateAsync({
            sessionId: session[0].id,
            exerciseId: re.exerciseId,
            order: re.order,
            notes: lastSession?.exercises?.find((e) => e.exerciseId === re.exerciseId)?.notes ?? undefined,
          });
          const sessionExerciseId = se[0].id;
          const plannedSets = re.targetSets ?? DEFAULT_TARGET_SETS;
          for (let i = 1; i <= plannedSets; i++) {
            await createSet.mutateAsync({
              sessionExerciseId,
              setNumber: i,
            });
          }
        }
      }

      router.replace(`/session/${session[0].id}`);
    } catch (error) {
      await haptics.error();
      Alert.alert('Error', 'Failed to create session');
    }
  };

  if (isLoading) {
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
          <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.secondary, marginTop: spacing.sm }} className="text-sm text-dark-text-secondary mt-2">
            {routineExercises?.length ?? 0} exercises
          </Text>
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