import { Text, View, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCreateSession } from '../../lib/hooks/useSessions';
import { useRoutine, useRoutineExercises } from '../../lib/hooks/useRoutines';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { haptics } from '../../lib/utils/haptics';

export default function NewSessionScreen() {
  const router = useRouter();
  const { routineId } = useLocalSearchParams<{ routineId?: string }>();
  const createSession = useCreateSession();

  const routineIdNum = routineId ? parseInt(routineId, 10) : undefined;
  const { data: routines, isLoading: routineLoading } = useRoutine(routineIdNum ?? 0);
  const { data: routineExercises, isLoading: exercisesLoading } = useRoutineExercises(routineIdNum ?? 0);

  const routine = routines?.[0];
  const isLoading = routineIdNum ? (routineLoading || exercisesLoading) : false;

  const handleStartSession = async () => {
    try {
      await haptics.success();
      const session = await createSession.mutateAsync({
        routineId: routineIdNum,
      });
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
    <View className="flex-1 bg-white p-4">
      <Text className="text-lg font-semibold text-gray-900 mb-4">Start New Session</Text>
      
      {routine ? (
        <View className="bg-gray-50 rounded-lg p-4 mb-4">
          <Text className="text-base font-medium text-gray-900">{routine.name}</Text>
          {routine.description && (
            <Text className="text-sm text-gray-500 mt-1">{routine.description}</Text>
          )}
          <Text className="text-sm text-gray-500 mt-2">
            {routineExercises?.length ?? 0} exercises
          </Text>
        </View>
      ) : (
        <View className="bg-gray-50 rounded-lg p-4 mb-4">
          <Text className="text-base font-medium text-gray-900">Empty Session</Text>
          <Text className="text-sm text-gray-500 mt-1">
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