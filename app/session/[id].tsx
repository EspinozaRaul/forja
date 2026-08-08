import { Text, View, ScrollView, Alert, TouchableOpacity, TextInput, Modal } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { colors, spacing, borderRadius } from '../../lib/theme/tokens';
import { useSession, useSessionExercises, useCompleteSession, useAddExerciseToSession, useUpdateExerciseRestTime, useUpdateSessionExerciseOrder, useReplaceSessionExercise } from '../../lib/hooks/useSessions';

const SESSION_KEY = ['sessions'];
import { useExercise, useExercises, useUpdateExercise } from '../../lib/hooks/useExercises';
import { useSets, useCreateSet, useUpdateSet, useDeleteSet } from '../../lib/hooks/useSets';
import { Timer } from '../../components/Timer';
import { RestTimer } from '../../components/RestTimer';
import { SetLogger } from '../../components/SetLogger';
import { Button } from '../../components/ui/Button';
import { ExercisePicker } from '../../components/ExercisePicker';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { EXERCISE_NAMES_ES } from '../../lib/db/exercise-names-es';
import { haptics } from '../../lib/utils/haptics';
import type { SessionExercise, Set } from '../../lib/types';

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const sessionId = parseInt(id, 10);

  const { data: sessions, isLoading: sessionLoading } = useSession(sessionId);
  const { data: sessionExercises, isLoading: exercisesLoading } = useSessionExercises(sessionId);
  const completeSession = useCompleteSession();
  const addExerciseToSession = useAddExerciseToSession();
  const updateOrder = useUpdateSessionExerciseOrder();
  const { data: allExercises } = useExercises();

  const session = sessions?.[0];
  const isLoading = sessionLoading || exercisesLoading;

  const sortedExercises = sessionExercises?.sort((a, b) => a.order - b.order) ?? [];

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showPicker, setShowPicker] = useState(false);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restDuration, setRestDuration] = useState(60);
  const [restExerciseName, setRestExerciseName] = useState('');
  const [replaceId, setReplaceId] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const replaceSessionExercise = useReplaceSessionExercise();

  const handleDragHandleTap = async (index: number) => {
    if (dragIndex === null) {
      setDragIndex(index);
    } else if (dragIndex === index) {
      setDragIndex(null);
    } else {
      const source = sortedExercises[dragIndex];
      const target = sortedExercises[index];
      if (!source || !target) return;

      // Optimistic update
      const previousExercises = sessionExercises;
      const reordered = sortedExercises.map((se, i) => {
        if (i === dragIndex) return { ...se, order: index + 1 };
        if (i === index) return { ...se, order: dragIndex + 1 };
        return se;
      });
      queryClient.setQueryData([...SESSION_KEY, sessionId, 'exercises'], reordered);

      try {
        await updateOrder.mutateAsync({ id: target.id, order: dragIndex + 1 });
        await updateOrder.mutateAsync({ id: source.id, order: index + 1 });
      } catch (error) {
        queryClient.setQueryData([...SESSION_KEY, sessionId, 'exercises'], previousExercises);
        Alert.alert('Error', 'Failed to reorder');
      }
      setDragIndex(null);
    }
  };

  const handleReplaceExercise = async (exercise: { id: number }) => {
    if (replaceId === null) return;
    
    const previousExercises = sessionExercises;
    const updated = sessionExercises?.map((se) =>
      se.id === replaceId ? { ...se, exerciseId: exercise.id } : se
    );
    queryClient.setQueryData([...SESSION_KEY, sessionId, 'exercises'], updated);
    
    try {
      await replaceSessionExercise.mutateAsync({ id: replaceId, exerciseId: exercise.id });
    } catch (error) {
      queryClient.setQueryData([...SESSION_KEY, sessionId, 'exercises'], previousExercises);
      Alert.alert('Error', 'Failed to replace exercise');
    }
    setReplaceId(null);
    setShowPicker(false);
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading session..." />;
  }

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, padding: spacing.md }}>
        <EmptyState title="Session not found" />
      </View>
    );
  }

  const handleEndSession = async () => {
    Alert.alert(
      'End Session',
      'Are you sure you want to end this session?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End Session', style: 'destructive', onPress: completeSessionAndNavigate },
      ]
    );
  };

  const completeSessionAndNavigate = async () => {
    try {
      await haptics.heavy();
      await completeSession.mutateAsync({
        id: sessionId,
        data: { duration: elapsedSeconds },
      });
      router.push(`/session/history/${sessionId}`);
    } catch (error) {
      await haptics.error();
      Alert.alert('Error', 'Failed to end session');
    }
  };

  const handleAddExercise = async (exercise: { id: number }) => {
    try {
      await addExerciseToSession.mutateAsync({
        sessionId,
        exerciseId: exercise.id,
        order: (sessionExercises?.length ?? 0) + 1,
      });
      setShowPicker(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to add exercise');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {/* Timer + Header — fixed top */}
      <View style={{ backgroundColor: colors.bg.card, paddingHorizontal: spacing.md, paddingTop: insets.top + spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: spacing.sm + spacing.xs }}>
            <Text style={{ fontSize: 20, color: colors.accent.primary }}>←</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text.primary, flex: 1 }}>Session</Text>
        </View>
        <Timer sessionId={id} onTimeUpdate={setElapsedSeconds} autoStart />
      </View>

      {/* Exercises — scrollable middle */}
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
        <View style={{ padding: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text.primary }}>Exercises</Text>
            <TouchableOpacity
              onPress={() => setShowPicker(true)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm }}
            >
              <Text style={{ fontSize: 14, color: colors.accent.primary }}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {dragIndex !== null && (
            <View style={{ backgroundColor: colors.bg.active, borderRadius: borderRadius.sm, padding: 10, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.accent.primary }}>
              <Text style={{ fontSize: 12, color: colors.accent.primary, textAlign: 'center' }}>
                Tap another exercise to swap — or tap the same to cancel
              </Text>
            </View>
          )}

          {sortedExercises.length === 0 ? (
            <EmptyState title="No exercises" message="Add exercises to this session." />
          ) : (
            sortedExercises.map((se, index) => (
              <Animated.View key={se.id} layout={LinearTransition.duration(200)}>
                <SessionExerciseItem
                  sessionExercise={se}
                  onSetCompleted={(exerciseName, restTime) => {
                    setRestExerciseName(exerciseName);
                    setRestDuration(restTime);
                    setShowRestTimer(true);
                  }}
                  onReplace={() => { setReplaceId(se.id); setShowPicker(true); }}
                  onDragTap={() => handleDragHandleTap(index)}
                  isDragging={dragIndex === index}
                />
              </Animated.View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Bottom — fixed: rest timer + end session */}
      <View style={{ backgroundColor: colors.bg.card, borderTopWidth: 1, borderTopColor: colors.border.primary, paddingBottom: insets.bottom + spacing.sm }}>
        {showRestTimer && (
          <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm + spacing.xs }}>
            {restExerciseName ? (
              <Text style={{ fontSize: 11, color: colors.text.secondary, marginBottom: spacing.xs, textAlign: 'center' }}>
                Descanso: {restExerciseName}
              </Text>
            ) : null}
            <RestTimer
              sessionId={id}
              duration={restDuration}
              autoStart
              onComplete={() => setShowRestTimer(false)}
              onSkip={() => setShowRestTimer(false)}
              onDurationChange={setRestDuration}
            />
          </View>
        )}

        <View style={{ paddingHorizontal: spacing.md, paddingTop: showRestTimer ? spacing.sm : spacing.sm + spacing.xs }}>
          <TouchableOpacity
            onPress={handleEndSession}
            style={{ backgroundColor: colors.error, borderRadius: borderRadius.md, paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: colors.text.primary, fontWeight: '700', fontSize: 16 }}>End Session</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ExercisePicker
        visible={showPicker}
        exercises={allExercises ?? []}
        onSelect={replaceId !== null ? handleReplaceExercise : handleAddExercise}
        onPreview={(exercise) => {
          setShowPicker(false);
          router.push(`/exercise/${exercise.id}`);
        }}
        onClose={() => { setShowPicker(false); setReplaceId(null); }}
      />
    </View>
  );
}

function SessionExerciseItem({ sessionExercise, onSetCompleted, onReplace, onDragTap, isDragging }: {
  sessionExercise: SessionExercise;
  onSetCompleted?: (exerciseName: string, restTime: number) => void;
  onReplace?: () => void;
  onDragTap?: () => void;
  isDragging?: boolean;
}) {
  const { data: exercises } = useExercise(sessionExercise.exerciseId);
  const { data: sets } = useSets(sessionExercise.id);
  const createSet = useCreateSet();
  const updateSet = useUpdateSet();
  const deleteSet = useDeleteSet();
  const updateRestTime = useUpdateExerciseRestTime();
  const updateExercise = useUpdateExercise();
  const [showRestPicker, setShowRestPicker] = useState(false);
  const [showCustomRest, setShowCustomRest] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const [customSeconds, setCustomSeconds] = useState('');

  const exercise = exercises?.[0];
  const currentRestTime = sessionExercise.restTime ?? 60;

  const handleAddSet = async () => {
    await haptics.press();
    const nextSetNumber = (sets?.length ?? 0) + 1;
    await createSet.mutateAsync({
      sessionExerciseId: sessionExercise.id,
      setNumber: nextSetNumber,
    });
  };

  const handleUpdateSet = async (set: Set, updates: { reps?: number; weight?: number; completed?: boolean }) => {
    if (updates.completed && !set.completed) {
      await haptics.complete();
      onSetCompleted?.(exercise ? (EXERCISE_NAMES_ES[exercise.name] || exercise.name) : 'Ejercicio', currentRestTime);
    }
    await updateSet.mutateAsync({
      id: set.id,
      data: updates,
    });
  };

  const handleDeleteSet = async (setId: number) => {
    await haptics.warning();
    await deleteSet.mutateAsync(setId);
  };

  const handleSetRestTime = async (seconds: number) => {
    await updateRestTime.mutateAsync({ id: sessionExercise.id, restTime: seconds });
    setShowRestPicker(false);
  };

  const handleUnitChange = async (unit: string) => {
    if (exercise) {
      await updateExercise.mutateAsync({
        id: exercise.id,
        data: { unit },
      });
    }
  };

  const REST_PRESETS = [30, 60, 90, 120, 180];

  return (
    <View
      style={{
        backgroundColor: isDragging ? colors.bg.active : colors.bg.card,
        borderRadius: borderRadius.sm,
        padding: spacing.sm + spacing.xs,
        marginBottom: spacing.sm + spacing.xs,
        borderWidth: 1,
        borderColor: isDragging ? colors.accent.primary : colors.border.primary,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <TouchableOpacity
          onPress={onDragTap}
          activeOpacity={0.7}
          style={{ gap: 3, paddingRight: spacing.sm, borderRightWidth: 1, borderRightColor: colors.border.divider }}
        >
          <View style={{ width: 16, height: 2, backgroundColor: isDragging ? colors.accent.primary : colors.text.muted, borderRadius: 1 }} />
          <View style={{ width: 16, height: 2, backgroundColor: isDragging ? colors.accent.primary : colors.text.muted, borderRadius: 1 }} />
          <View style={{ width: 16, height: 2, backgroundColor: isDragging ? colors.accent.primary : colors.text.muted, borderRadius: 1 }} />
        </TouchableOpacity>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text.primary, flex: 1 }}>
          {exercise ? (EXERCISE_NAMES_ES[exercise.name] || exercise.name) : 'Ejercicio desconocido'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {onReplace && (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onReplace(); }}
              style={{ padding: spacing.xs }}
            >
              <Text style={{ fontSize: 14, color: colors.accent.primary }}>↻</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setShowRestPicker(!showRestPicker)}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.border.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}
          >
            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text.secondary }}>
              {currentRestTime >= 60 ? `${currentRestTime / 60}m` : `${currentRestTime}s`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Rest time picker */}
      {showRestPicker && (
        <View style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: borderRadius.sm, flexWrap: 'wrap', marginBottom: borderRadius.sm }}>
            {REST_PRESETS.map((dur) => (
              <TouchableOpacity
                key={dur}
                onPress={() => handleSetRestTime(dur)}
                style={{
                  backgroundColor: currentRestTime === dur ? colors.accent.primary : colors.bg.elevated,
                  borderRadius: borderRadius.sm,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderWidth: currentRestTime === dur ? 0 : 1,
                  borderColor: colors.border.primary,
                }}
              >
                <Text style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: currentRestTime === dur ? colors.bg.primary : colors.text.secondary,
                }}>
                  {dur >= 60 ? `${dur / 60}m` : `${dur}s`}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => {
                const mins = Math.floor(currentRestTime / 60);
                const secs = currentRestTime % 60;
                setCustomMinutes(mins > 0 ? String(mins) : '');
                setCustomSeconds(secs > 0 ? String(secs) : '');
                setShowCustomRest(true);
              }}
              style={{
                backgroundColor: colors.bg.elevated,
                borderRadius: borderRadius.sm,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderWidth: 1,
                borderColor: colors.accent.primary,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text.secondary }}>Custom</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Custom rest time modal */}
      <Modal visible={showCustomRest} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, width: 280, borderWidth: 1, borderColor: colors.border.primary }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text.primary, marginBottom: spacing.md, textAlign: 'center' }}>Tiempo de descanso</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: 20 }}>
              <TextInput
                value={customMinutes}
                onChangeText={setCustomMinutes}
                placeholder="0"
                placeholderTextColor={colors.text.muted}
                keyboardType="number-pad"
                maxLength={3}
                style={{ backgroundColor: colors.border.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + spacing.xs, color: colors.text.primary, fontSize: 24, fontFamily: 'monospace', fontWeight: '700', width: 80, textAlign: 'center' }}
              />
              <Text style={{ fontSize: 20, color: colors.text.secondary, fontWeight: '600' }}>min</Text>
              <Text style={{ fontSize: 20, color: colors.text.muted }}>:</Text>
              <TextInput
                value={customSeconds}
                onChangeText={setCustomSeconds}
                placeholder="0"
                placeholderTextColor={colors.text.muted}
                keyboardType="number-pad"
                maxLength={2}
                style={{ backgroundColor: colors.border.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + spacing.xs, color: colors.text.primary, fontSize: 24, fontFamily: 'monospace', fontWeight: '700', width: 80, textAlign: 'center' }}
              />
              <Text style={{ fontSize: 20, color: colors.text.secondary, fontWeight: '600' }}>seg</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm + spacing.xs }}>
              <TouchableOpacity
                onPress={() => setShowCustomRest(false)}
                style={{ flex: 1, paddingVertical: spacing.sm + spacing.xs, borderRadius: borderRadius.sm, backgroundColor: colors.border.primary, alignItems: 'center' }}
              >
                <Text style={{ color: colors.text.secondary, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const mins = parseInt(customMinutes || '0', 10);
                  const secs = parseInt(customSeconds || '0', 10);
                  const total = mins * 60 + secs;
                  if (total > 0) {
                    handleSetRestTime(total);
                    setShowCustomRest(false);
                  }
                }}
                style={{ flex: 1, paddingVertical: spacing.sm + spacing.xs, borderRadius: borderRadius.sm, backgroundColor: colors.accent.primary, alignItems: 'center' }}
              >
                <Text style={{ color: colors.bg.primary, fontWeight: '700' }}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {sets?.map((set) => (
        <SetLogger
          key={set.id}
          set={set}
          onUpdate={(updates) => handleUpdateSet(set, updates)}
          onDelete={() => handleDeleteSet(set.id)}
          unit={exercise?.unit ?? 'kg'}
          onUnitChange={handleUnitChange}
        />
      ))}
      <Button
        title="Add Set"
        variant="secondary"
        onPress={handleAddSet}
        loading={createSet.isPending}
      />
    </View>
  );
}
