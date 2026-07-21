import { Text, View, ScrollView, TextInput, Alert } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSession, useSessionExercises, useCompleteSession } from '../../../lib/hooks/useSessions';
import { useExercise } from '../../../lib/hooks/useExercises';
import { useSets } from '../../../lib/hooks/useSets';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { formatDuration } from '../../../lib/utils/format';
import type { SessionExercise } from '../../../lib/types';

export default function SessionSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const sessionId = parseInt(id, 10);

  const { data: sessions, isLoading: sessionLoading } = useSession(sessionId);
  const { data: sessionExercises, isLoading: exercisesLoading } = useSessionExercises(sessionId);
  const completeSession = useCompleteSession();

  const session = sessions?.[0];
  const isLoading = sessionLoading || exercisesLoading;

  const [notes, setNotes] = useState(session?.notes ?? '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  if (isLoading) {
    return <LoadingSpinner message="Loading session summary..." />;
  }

  if (!session) {
    return (
      <View className="flex-1 bg-white p-4">
        <EmptyState title="Session not found" />
      </View>
    );
  }

  // Calculate stats
  const exerciseCount = sessionExercises?.length ?? 0;
  const duration = session.duration ?? 0;

  const handleSaveNotes = async () => {
    try {
      await completeSession.mutateAsync({
        id: sessionId,
        data: { notes: notes.trim() || undefined },
      });
      setIsEditingNotes(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to save notes');
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Session Info */}
      <View className="bg-white p-4 border-b border-gray-200">
        <Text className="text-lg font-semibold text-gray-900 mb-2">Session Summary</Text>
        <View className="flex-row justify-between">
          <View className="items-center flex-1">
            <Text className="text-2xl font-bold text-blue-500">{exerciseCount}</Text>
            <Text className="text-sm text-gray-500">Exercises</Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-2xl font-bold text-green-500">
              {formatDuration(duration)}
            </Text>
            <Text className="text-sm text-gray-500">Duration</Text>
          </View>
        </View>
      </View>

      {/* Notes */}
      <View className="bg-white p-4 border-t border-gray-200">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-medium text-gray-700">Notes</Text>
          <Button
            title={isEditingNotes ? 'Save' : 'Edit'}
            variant="secondary"
            onPress={() => {
              if (isEditingNotes) {
                handleSaveNotes();
              } else {
                setNotes(session.notes ?? '');
                setIsEditingNotes(true);
              }
            }}
            loading={completeSession.isPending}
          />
        </View>
        {isEditingNotes ? (
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-base text-gray-900"
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes about this session..."
            placeholderTextColor="#9CA3AF"
          />
        ) : (
          <Text className="text-gray-600">
            {session.notes || 'No notes'}
          </Text>
        )}
      </View>

      {/* Exercises and Sets */}
      <View className="bg-white p-4 border-t border-gray-200">
        <Text className="text-lg font-semibold text-gray-900 mb-3">Exercises</Text>
        {!sessionExercises || sessionExercises.length === 0 ? (
          <EmptyState
            title="No exercises logged"
            message="This session has no recorded exercises."
          />
        ) : (
          sessionExercises.map((se) => (
            <SessionExerciseSummary key={se.id} sessionExercise={se} />
          ))
        )}
      </View>

      {/* Back Button */}
      <View className="p-4 bg-white border-t border-gray-200">
        <Button
          title="Back to Home"
          onPress={() => router.push('/')}
        />
      </View>
    </ScrollView>
  );
}

function SessionExerciseSummary({ sessionExercise }: { sessionExercise: SessionExercise }) {
  const { data: exercises } = useExercise(sessionExercise.exerciseId);
  const { data: sets } = useSets(sessionExercise.id);

  const exercise = exercises?.[0];
  const completedSets = sets?.filter((s) => s.completed) ?? [];
  const totalVolume = completedSets.reduce((sum, set) => {
    return sum + (set.reps ?? 0) * (set.weight ?? 0);
  }, 0);

  return (
    <View className="mb-4">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-base font-semibold text-gray-900">
          {exercise?.name ?? 'Unknown Exercise'}
        </Text>
        <Text className="text-sm text-gray-500">
          {completedSets.length} sets • {totalVolume.toFixed(0)} kg
        </Text>
      </View>
      {sets && sets.length > 0 ? (
        <View className="bg-gray-50 rounded-lg p-2">
          {sets.map((set) => (
            <View
              key={set.id}
              className="flex-row justify-between py-1 border-b border-gray-100 last:border-b-0"
            >
              <Text className="text-sm text-gray-600">Set {set.setNumber}</Text>
              <Text className="text-sm text-gray-900">
                {set.reps ?? '-'} reps × {set.weight ?? '-'} kg
              </Text>
              <Text className={`text-sm ${set.completed ? 'text-green-500' : 'text-gray-400'}`}>
                {set.completed ? '✓' : '○'}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text className="text-sm text-gray-400">No sets logged</Text>
      )}
    </View>
  );
}