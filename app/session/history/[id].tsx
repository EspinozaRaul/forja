import { Text, View, ScrollView, TextInput, Alert, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSession, useSessionExercises, useCompleteSession } from '../../../lib/hooks/useSessions';
import { useExercise } from '../../../lib/hooks/useExercises';
import { useSets } from '../../../lib/hooks/useSets';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { EXERCISE_NAMES_ES } from '../../../lib/db/exercise-names-es';
import { formatDuration, formatVolume } from '../../../lib/utils/format';
import { useSettings } from '../../../lib/utils/settings';
import { resolveUnit, formatWeight } from '../../../lib/utils/weight-unit';
import { colors, spacing, borderRadius, fonts } from '../../../lib/theme/tokens';
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
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, padding: spacing.md }}>
        <EmptyState title="Session not found" />
      </View>
    );
  }

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
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg.primary }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {/* Session Info */}
      <View style={{ backgroundColor: colors.bg.card, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border.primary }}>
        <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.sm }}>
          Session Summary
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 28, fontFamily: fonts.display, fontWeight: 'bold', color: colors.accent.primary }}>{exerciseCount}</Text>
            <Text style={{ fontSize: 13, fontFamily: fonts.body, color: colors.text.secondary }}>Exercises</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 28, fontFamily: fonts.display, fontWeight: 'bold', color: colors.accent.primary }}>
              {formatDuration(duration)}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: fonts.body, color: colors.text.secondary }}>Duration</Text>
          </View>
        </View>
      </View>

      {/* Notes */}
      <View style={{ backgroundColor: colors.bg.card, padding: spacing.lg, marginTop: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text style={{ fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text.secondary }}>Notes</Text>
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
            style={{
              backgroundColor: colors.bg.elevated,
              borderWidth: 1,
              borderColor: colors.border.primary,
              borderRadius: borderRadius.sm,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              fontSize: 16,
              color: colors.text.primary,
              minHeight: 80,
              textAlignVertical: 'top',
            }}
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes about this session..."
            placeholderTextColor={colors.text.muted}
          />
        ) : (
          <Text style={{ color: colors.text.secondary, fontFamily: fonts.body }}>
            {session.notes || 'No notes'}
          </Text>
        )}
      </View>

      {/* Exercises and Sets */}
      <View style={{ backgroundColor: colors.bg.card, padding: spacing.lg, marginTop: spacing.sm }}>
        <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md }}>
          Exercises
        </Text>
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
      <View style={{ padding: spacing.md, marginTop: spacing.sm }}>
        <Button
          title="Back to Home"
          onPress={() => router.push('/')}
        />
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function SessionExerciseSummary({ sessionExercise }: { sessionExercise: SessionExercise }) {
  const { data: exercises } = useExercise(sessionExercise.exerciseId);
  const { data: sets } = useSets(sessionExercise.id);
  const router = useRouter();
  const settings = useSettings();

  const exercise = exercises?.[0];
  const unit = resolveUnit(exercise?.unit, settings.data.weightUnit);
  const completedSets = sets?.filter((s) => s.completed) ?? [];
  const totalVolume = completedSets.reduce((sum, set) => {
    return sum + (set.reps ?? 0) * (set.weight ?? 0);
  }, 0);

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <TouchableOpacity onPress={() => router.push(`/exercise/${sessionExercise.exerciseId}`)}>
          <Text style={{ fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.accent.primary }}>
            {exercise ? (EXERCISE_NAMES_ES[exercise.name] || exercise.name) : 'Ejercicio desconocido'}
          </Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 13, color: colors.text.muted }}>
          {completedSets.length} sets • {formatVolume(totalVolume, unit)}
        </Text>
      </View>
      {sets && sets.length > 0 ? (
        <View style={{ backgroundColor: colors.bg.elevated, borderRadius: borderRadius.sm, padding: spacing.sm }}>
          {sets.map((set) => (
            <View
              key={set.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: spacing.xs,
                borderBottomWidth: 1,
                borderBottomColor: colors.border.primary,
              }}
            >
              <Text style={{ fontSize: 14, color: colors.text.secondary }}>Set {set.setNumber}</Text>
              <Text style={{ fontSize: 14, color: colors.text.primary }}>
                {set.reps ?? '-'} reps × {formatWeight(set.weight, unit)}
              </Text>
              <Text style={{ fontSize: 14, color: set.completed ? colors.success : colors.text.muted }}>
                {set.completed ? '✓' : '○'}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.muted }}>No sets logged</Text>
      )}
    </View>
  );
}
