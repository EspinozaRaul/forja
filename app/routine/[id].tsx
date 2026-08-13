import { Text, View, ScrollView, Alert, Modal, Pressable, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { colors, spacing, borderRadius, fonts } from '../../lib/theme/tokens';
import { useRoutine, useRoutineExercises, useUpdateRoutine, useAddExerciseToRoutine, useRemoveExerciseFromRoutine, useDeleteRoutine, useUpdateRoutineExerciseOrder, useReplaceRoutineExercise } from '../../lib/hooks/useRoutines';
import { useExercises } from '../../lib/hooks/useExercises';
import { useCreateSession, useAddExerciseToSession, useLastSessionForRoutine, useDuplicateSessionData } from '../../lib/hooks/useSessions';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ExercisePicker } from '../../components/ExercisePicker';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { haptics } from '../../lib/utils/haptics';
import { EXERCISE_NAMES_ES } from '../../lib/db/exercise-names-es';
import { summarizeSets } from '../../lib/utils/session-summary';

export default function RoutineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const routineId = parseInt(id, 10);

  const { data: routines, isLoading: routineLoading } = useRoutine(routineId);
  const { data: routineExercises, isLoading: exercisesLoading } = useRoutineExercises(routineId);
  const { data: allExercises, isLoading: allExercisesLoading } = useExercises();
  const updateRoutine = useUpdateRoutine();
  const addExerciseToRoutine = useAddExerciseToRoutine();
  const removeExerciseFromRoutine = useRemoveExerciseFromRoutine();
  const deleteRoutine = useDeleteRoutine();
  const updateOrder = useUpdateRoutineExerciseOrder();
  const createSession = useCreateSession();
  const addExerciseToSession = useAddExerciseToSession();
  const { data: lastSession } = useLastSessionForRoutine(routineId);
  const duplicateSessionData = useDuplicateSessionData();

  const routine = routines?.[0];
  const isLoading = routineLoading || exercisesLoading || allExercisesLoading;

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const replaceExercise = useReplaceRoutineExercise();

  const routineExercisesWithDetails = routineExercises
    ?.map((re) => {
      const exercise = allExercises?.find((e) => e.id === re.exerciseId);
      return { ...re, exercise };
    })
    ?.sort((a, b) => a.order - b.order) ?? [];

  const handleStartEdit = () => {
    if (routine) {
      setEditName(routine.name);
      setEditDescription(routine.description ?? '');
      setIsEditing(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    try {
      await updateRoutine.mutateAsync({
        id: routineId,
        data: { name: editName.trim(), description: editDescription.trim() || undefined },
      });
      setIsEditing(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update routine');
    }
  };

  const handleAddExercise = async (exercise: { id: number }) => {
    try {
      await addExerciseToRoutine.mutateAsync({
        routineId,
        exerciseId: exercise.id,
        order: routineExercisesWithDetails.length + 1,
        targetSets: 3,
        targetReps: 10,
      });
      setShowPicker(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to add exercise');
    }
  };

  const handleMultiAddExercises = async (exercises: { id: number }[]) => {
    try {
      for (let i = 0; i < exercises.length; i++) {
        await addExerciseToRoutine.mutateAsync({
          routineId,
          exerciseId: exercises[i].id,
          order: routineExercisesWithDetails.length + i + 1,
          targetSets: 3,
          targetReps: 10,
        });
      }
      setShowPicker(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to add exercises');
    }
  };

  const handleDragHandleTap = async (index: number) => {
    if (dragIndex === null) {
      setDragIndex(index);
    } else if (dragIndex === index) {
      setDragIndex(null);
    } else {
      // Swap and persist
      const target = routineExercisesWithDetails[index];
      const source = routineExercisesWithDetails[dragIndex];
      if (!target || !source) return;
      
      try {
        await updateOrder.mutateAsync({ id: target.id, order: dragIndex + 1 });
        await updateOrder.mutateAsync({ id: source.id, order: index + 1 });
      } catch (error) {
        Alert.alert('Error', 'Failed to reorder');
      }
      setDragIndex(null);
    }
  };

  const handleReplaceExercise = async (exercise: { id: number }) => {
    if (replaceIndex === null) return;
    const target = routineExercisesWithDetails[replaceIndex];
    if (!target) return;
    
    try {
      await replaceExercise.mutateAsync({ id: target.id, exerciseId: exercise.id });
    } catch (error) {
      Alert.alert('Error', 'Failed to replace exercise');
    }
    setReplaceIndex(null);
    setShowPicker(false);
  };

  const handleRemoveExercise = async (routineExerciseId: number) => {
    Alert.alert(
      'Remove Exercise',
      'Are you sure you want to remove this exercise from the routine?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await haptics.warning();
              await removeExerciseFromRoutine.mutateAsync(routineExerciseId);
              setDragIndex(null);
            } catch (error) {
              await haptics.error();
              Alert.alert('Error', 'Failed to remove exercise');
            }
          }
        },
      ]
    );
  };

  const handleDeleteRoutine = async () => {
    Alert.alert(
      'Delete Routine',
      'Are you sure you want to delete this routine? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await haptics.warning();
              await deleteRoutine.mutateAsync(routineId);
              router.back();
            } catch (error) {
              await haptics.error();
              Alert.alert('Error', 'Failed to delete routine');
            }
          }
        },
      ]
    );
  };

  const handleStartSession = async (continueFromLast: boolean = false) => {
    try {
      await haptics.success();
      const session = await createSession.mutateAsync({ routineId });

      if (continueFromLast && lastSession) {
        await duplicateSessionData.mutateAsync({
          sourceSessionId: lastSession.id,
          targetSessionId: session[0].id,
        });
      } else {
        for (const re of routineExercisesWithDetails) {
          await addExerciseToSession.mutateAsync({
            sessionId: session[0].id,
            exerciseId: re.exerciseId,
            order: re.order,
          });
        }
      }

      router.push(`/session/${session[0].id}`);
    } catch (error) {
      await haptics.error();
      Alert.alert('Error', 'Failed to start session');
    }
  };

  const handleStartPress = () => {
    if (lastSession) {
      setShowStartModal(true);
    } else {
      handleStartSession(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading routine..." />;
  }

  if (!routine) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, padding: spacing.md }}>
        <EmptyState title="Routine not found" />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {/* Routine Info */}
      <View style={{ backgroundColor: colors.bg.card, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border.primary }}>
        {isEditing ? (
          <>
            <Input label="Routine Name" value={editName} onChangeText={setEditName} placeholder="Routine name" />
            <Input label="Description" value={editDescription} onChangeText={setEditDescription} placeholder="Description (optional)" multiline />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Save" onPress={handleSaveEdit} loading={updateRoutine.isPending} />
              <Button title="Cancel" variant="secondary" onPress={() => setIsEditing(false)} />
            </View>
          </>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={{ fontSize: 20, fontFamily: fonts.bodySemiBold, color: colors.text.primary, flex: 1 }}>{routine.name}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button title="Edit" variant="secondary" onPress={handleStartEdit} />
                <Button title="Delete" variant="danger" onPress={handleDeleteRoutine} />
              </View>
            </View>
            {routine.description && (
              <Text style={{ color: colors.text.secondary, fontFamily: fonts.body, marginBottom: spacing.sm + spacing.xs }}>{routine.description}</Text>
            )}
          </>
        )}
      </View>

      {/* Exercises List */}
      <View style={{ backgroundColor: colors.bg.card, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm + spacing.xs }}>
          <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>Exercises</Text>
          <Button title="Add Exercise" variant="secondary" onPress={() => setShowPicker(true)} />
        </View>

        {dragIndex !== null && (
          <View style={{ backgroundColor: colors.bg.active, borderRadius: borderRadius.sm, padding: spacing.sm + spacing.xs, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.accent.primary }}>
            <Text style={{ fontSize: 12, color: colors.accent.primary, textAlign: 'center' }}>
              Tap another exercise to swap — or tap the same to cancel
            </Text>
          </View>
        )}

        {routineExercisesWithDetails.length === 0 ? (
          <EmptyState title="No exercises" message="Add exercises to this routine." />
        ) : (
          routineExercisesWithDetails.map((re, index) => (
            <Animated.View
              key={re.id}
              layout={LinearTransition.duration(200)}
            >
              <View
                style={{
                  backgroundColor: dragIndex === index ? colors.bg.active : colors.bg.elevated,
                  borderRadius: borderRadius.sm,
                  padding: spacing.sm + spacing.xs,
                  marginBottom: spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  borderWidth: 1,
                  borderColor: dragIndex === index ? colors.accent.primary : 'transparent',
                }}
              >
                <TouchableOpacity
                  onPress={() => handleDragHandleTap(index)}
                  activeOpacity={0.7}
                  style={{ gap: 3, paddingRight: spacing.sm, borderRightWidth: 1, borderRightColor: colors.border.divider }}
                >
                  <View style={{ width: 16, height: 2, backgroundColor: dragIndex === index ? colors.accent.primary : colors.text.muted, borderRadius: 1 }} />
                  <View style={{ width: 16, height: 2, backgroundColor: dragIndex === index ? colors.accent.primary : colors.text.muted, borderRadius: 1 }} />
                  <View style={{ width: 16, height: 2, backgroundColor: dragIndex === index ? colors.accent.primary : colors.text.muted, borderRadius: 1 }} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); re.exercise && router.push(`/exercise/${re.exercise.id}`); }}
                  style={{ flex: 1 }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
                    {re.exercise ? (EXERCISE_NAMES_ES[re.exercise.name] || re.exercise.name) : 'Ejercicio desconocido'}
                  </Text>
                  <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.secondary, marginTop: spacing.xs }}>
                    {re.targetSets ?? 3} sets × {re.targetReps ?? 10} reps
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); setReplaceIndex(index); setShowPicker(true); }}
                  style={{ padding: spacing.sm }}
                >
                  <Text style={{ fontSize: 14, color: colors.accent.primary }}>↻</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); handleRemoveExercise(re.id); }}
                  style={{ padding: spacing.sm }}
                >
                  <Text style={{ fontSize: 16, color: colors.error }}>✕</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          ))
        )}
      </View>

      {/* Start Session Button */}
      <View style={{ padding: spacing.md, paddingBottom: insets.bottom + spacing.md, backgroundColor: colors.bg.card, borderTopWidth: 1, borderTopColor: colors.border.primary }}>
        <Button
          title="Start Session"
          onPress={handleStartPress}
          loading={createSession.isPending}
          disabled={routineExercisesWithDetails.length === 0}
        />
      </View>

      <ExercisePicker
        visible={showPicker}
        exercises={allExercises ?? []}
        onSelect={replaceIndex !== null ? handleReplaceExercise : handleAddExercise}
        onMultiSelect={handleMultiAddExercises}
        onPreview={(exercise) => {
          setShowPicker(false);
          router.push(`/exercise/${exercise.id}`);
        }}
        onClose={() => { setShowPicker(false); setReplaceIndex(null); }}
        multiSelect={replaceIndex === null}
      />

      <Modal visible={showStartModal} transparent animationType="fade" onRequestClose={() => setShowStartModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg }} onPress={() => setShowStartModal(false)}>
          <Pressable style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: colors.border.primary }} onPress={(e) => e.stopPropagation()}>
            <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md }}>Start Session</Text>
            <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.secondary, marginBottom: spacing.md }}>
              You have a previous session for this routine. Want to continue with your last numbers?
            </Text>
            {lastSession && (
              <View style={{ backgroundColor: colors.bg.elevated, borderRadius: borderRadius.sm, padding: spacing.sm + spacing.xs, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border.primary }}>
                <Text style={{ fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.text.secondary, marginBottom: spacing.xs }}>Last session</Text>
                {lastSession.exercises?.map((se: any) => (
                  <View key={se.id} style={{ marginBottom: spacing.xs }}>
                    <Text style={{ fontSize: 14, color: colors.text.primary, fontFamily: fonts.bodySemiBold }}>{EXERCISE_NAMES_ES[se.exerciseName] || se.exerciseName || `Exercise ${se.order}`}</Text>
                    {summarizeSets(se.sets ?? []).map((line) => (
                      line.type === 'group' ? (
                        <Text key={`${se.id}-g-${line.setNumber}`} style={{ fontSize: 12, color: colors.accent.primary, fontFamily: fonts.bodyMedium, marginLeft: spacing.sm }}>
                          {line.label} × {line.count}
                        </Text>
                      ) : (
                        <Text key={`${se.id}-s-${line.setNumber}`} style={{ fontSize: 12, color: colors.text.secondary, fontFamily: fonts.body, marginLeft: spacing.sm }}>
                          Set {line.setNumber}: {line.reps ?? '—'} reps × {line.weight ?? '—'} kg
                        </Text>
                      )
                    ))}
                  </View>
                ))}
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Start Fresh" variant="secondary" onPress={() => { setShowStartModal(false); handleStartSession(false); }} />
              <Button title="Continue Last" onPress={() => { setShowStartModal(false); handleStartSession(true); }} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
