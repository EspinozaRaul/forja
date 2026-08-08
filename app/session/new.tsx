import { Text, View, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCreateSession, useAddExerciseToSession, useLastSessionForRoutine, useDuplicateSessionData } from '../../lib/hooks/useSessions';
import { useRoutine, useRoutineExercises } from '../../lib/hooks/useRoutines';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { haptics } from '../../lib/utils/haptics';

export default function NewSessionScreen() {
  const router = useRouter();
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
    <View style={{ flex: 1, backgroundColor: '#0A0A0A', padding: 16 }} className="flex-1 bg-white p-4">
      <Text style={{ fontSize: 18, fontWeight: '600', color: '#FFFFFF', marginBottom: 16 }} className="text-lg font-semibold text-gray-900 mb-4">Start New Session</Text>
      
      {routine ? (
        <View style={{ backgroundColor: '#222222', borderRadius: 8, padding: 16, marginBottom: 16 }} className="bg-gray-50 rounded-lg p-4 mb-4">
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }} className="text-base font-medium text-gray-900">{routine.name}</Text>
          {routine.description && (
            <Text style={{ fontSize: 14, color: '#A0A0A0', marginTop: 4 }} className="text-sm text-gray-500 mt-1">{routine.description}</Text>
          )}
          {shouldContinue && lastSession ? (
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 14, color: '#00F5A0', fontWeight: '600' }}>Continuing from last session</Text>
              {lastSession.exercises?.map((se: any) => (
                <View key={se.id} style={{ marginTop: 4, marginLeft: 8 }}>
                  <Text style={{ fontSize: 13, color: '#A0A0A0' }}>Exercise {se.order}</Text>
                  {se.sets?.map((s: any) => (
                    <Text key={s.id} style={{ fontSize: 12, color: '#A0A0A0', marginLeft: 8 }}>
                      Set {s.setNumber}: {s.reps ?? '—'} reps × {s.weight ?? '—'} kg
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 14, color: '#A0A0A0', marginTop: 8 }} className="text-sm text-gray-500 mt-2">
              {routineExercises?.length ?? 0} exercises
            </Text>
          )}
        </View>
      ) : (
        <View style={{ backgroundColor: '#222222', borderRadius: 8, padding: 16, marginBottom: 16 }} className="bg-gray-50 rounded-lg p-4 mb-4">
          <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }} className="text-base font-medium text-gray-900">Empty Session</Text>
          <Text style={{ fontSize: 14, color: '#A0A0A0', marginTop: 4 }} className="text-sm text-gray-500 mt-1">
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