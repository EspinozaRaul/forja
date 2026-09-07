import { Text, View, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSession, useSessionExercises, useCompleteSession } from '../../../lib/hooks/useSessions';
import { useExercise } from '../../../lib/hooks/useExercises';
import { useSets } from '../../../lib/hooks/useSets';
import { useCreateRoutine, useAddExerciseToRoutine } from '../../../lib/hooks/useRoutines';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { getExerciseName } from '../../../lib/utils/exercise-names';
import { formatDuration, formatVolume } from '../../../lib/utils/format';
import { useSettings } from '../../../lib/utils/settings';
import { resolveUnit, formatWeight } from '../../../lib/utils/weight-unit';
import { colors, spacing, borderRadius, fonts } from '../../../lib/theme/tokens';
import { haptics } from '../../../lib/utils/haptics';
import type { SessionExercise } from '../../../lib/types';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../../../lib/hooks/useConfirmDialog';
import { useTranslation } from 'react-i18next';

export default function SessionSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const sessionId = parseInt(id, 10);
  const { data: sessions, isLoading: sessionLoading } = useSession(sessionId);
  const { data: sessionExercises, isLoading: exercisesLoading } = useSessionExercises(sessionId);
  const completeSession = useCompleteSession();
  const createRoutine = useCreateRoutine();
  const addExerciseToRoutine = useAddExerciseToRoutine();
  const { dialog, showAlert, showConfirm } = useConfirmDialog();

  const session = sessions?.[0];
  const isLoading = sessionLoading || exercisesLoading;

  const [notes, setNotes] = useState(session?.notes ?? '');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [showSaveAsRoutine, setShowSaveAsRoutine] = useState(false);
  const [routineName, setRoutineName] = useState('');
  const [isSavingRoutine, setIsSavingRoutine] = useState(false);

  // Sync notes when session data arrives
  useEffect(() => {
    if (session) setNotes(session.notes ?? '');
  }, [session?.id]);

  if (isNaN(sessionId)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, padding: spacing.md }}>
        <EmptyState title={t('common.error')} message={t('common.invalidId')} />
      </View>
    );
  }

  if (isLoading) {
    return <LoadingSpinner message={t('session.history.loadingMessage')} />;
  }

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, padding: spacing.md }}>
        <EmptyState title={t('session.history.notFound')} />
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
      showAlert(t('common.error'), t('session.history.saveNotesFailed'));
    }
  };

  const handleSaveAsRoutine = async () => {
    if (!routineName.trim()) {
      showAlert(t('common.error'), t('session.history.nameRequired'));
      return;
    }
    if (!sessionExercises || sessionExercises.length === 0) {
      showAlert(t('common.error'), t('session.history.noExercisesToSave'));
      return;
    }

    setIsSavingRoutine(true);
    try {
      await haptics.success();
      const routine = await createRoutine.mutateAsync({
        name: routineName.trim(),
      });

      for (let i = 0; i < sessionExercises.length; i++) {
        const se = sessionExercises[i];
        await addExerciseToRoutine.mutateAsync({
          routineId: routine[0].id,
          exerciseId: se.exerciseId,
          order: se.order,
        });
      }

      setShowSaveAsRoutine(false);
      showConfirm(t('session.history.routineCreatedTitle'), t('session.history.routineCreatedMessage', { name: routineName.trim() }), () => router.push('/'), { confirmLabel: t('session.history.ok') });
    } catch (error) {
      showAlert(t('common.error'), t('session.history.saveRoutineFailed'));
    } finally {
      setIsSavingRoutine(false);
    }
  };

  const canSaveAsRoutine = session?.routineId == null && sessionExercises && sessionExercises.length > 0;

  return (
    <>
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg.primary }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {/* Session Info */}
      <View style={{ backgroundColor: colors.bg.card, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border.primary }}>
        <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.sm }}>
          {t('session.history.title')}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 28, fontFamily: fonts.display, fontWeight: 'bold', color: colors.accent.primary }}>{exerciseCount}</Text>
            <Text style={{ fontSize: 13, fontFamily: fonts.body, color: colors.text.secondary }}>{t('session.history.exercisesLabel')}</Text>
          </View>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 28, fontFamily: fonts.display, fontWeight: 'bold', color: colors.accent.primary }}>
              {formatDuration(duration)}
            </Text>
            <Text style={{ fontSize: 13, fontFamily: fonts.body, color: colors.text.secondary }}>{t('session.history.durationLabel')}</Text>
          </View>
        </View>
      </View>

      {/* Notes */}
      <View style={{ backgroundColor: colors.bg.card, padding: spacing.lg, marginTop: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <Text style={{ fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text.secondary }}>{t('session.history.notesLabel')}</Text>
          <Button
            title={isEditingNotes ? t('common.save') : t('common.edit')}
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
            placeholder={t('session.history.notesPlaceholder')}
            placeholderTextColor={colors.text.muted}
          />
        ) : (
          <Text style={{ color: colors.text.secondary, fontFamily: fonts.body }}>
            {session.notes || t('session.history.noNotes')}
          </Text>
        )}
      </View>

      {/* Save as Routine — only for quick/empty sessions */}
      {canSaveAsRoutine && (
        <View style={{ backgroundColor: colors.bg.card, padding: spacing.lg, marginTop: spacing.sm }}>
          <TouchableOpacity
            onPress={() => {
              setRoutineName(t('session.history.defaultRoutineName', { date: new Date().toLocaleDateString() }));
              setShowSaveAsRoutine(true);
            }}
            style={{
              backgroundColor: colors.accent.muted,
              borderRadius: borderRadius.sm,
              padding: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
            }}
          >
            <Text style={{ fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.accent.primary }}>
              {t('session.history.saveAsRoutine')}
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, color: colors.text.muted, textAlign: 'center', marginTop: spacing.xs }}>
            {t('session.history.saveAsRoutineSubtitle')}
          </Text>
        </View>
      )}

      {/* Exercises and Sets */}
      <View style={{ backgroundColor: colors.bg.card, padding: spacing.lg, marginTop: spacing.sm }}>
        <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md }}>
          {t('session.history.exercisesLabel')}
        </Text>
        {!sessionExercises || sessionExercises.length === 0 ? (
          <EmptyState
            title={t('session.history.noExercises')}
            message={t('session.history.noExercisesMessage')}
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
          title={t('session.history.backToHome')}
          onPress={() => router.push('/')}
        />
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>

    {/* Save as Routine Modal — outside ScrollView to prevent clipping */}
    {showSaveAsRoutine && (
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.lg, zIndex: 1000 }}>
        <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, width: '100%', maxWidth: 340, borderWidth: 1, borderColor: colors.border.primary }}>
          <Text style={{ fontSize: 17, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md, textAlign: 'center' }}>
            {t('session.history.saveAsRoutine')}
          </Text>
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
              marginBottom: spacing.md,
            } as any}
            value={routineName}
            onChangeText={setRoutineName}
            placeholder={t('session.history.routineNamePlaceholder')}
            placeholderTextColor={colors.text.muted}
            autoFocus
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => setShowSaveAsRoutine(false)}
              style={{ flex: 1, paddingVertical: spacing.sm + spacing.xs, borderRadius: borderRadius.sm, backgroundColor: colors.border.primary, alignItems: 'center' }}
            >
              <Text style={{ color: colors.text.secondary, fontWeight: '600' }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveAsRoutine}
              disabled={isSavingRoutine}
              style={{ flex: 1, paddingVertical: spacing.sm + spacing.xs, borderRadius: borderRadius.sm, backgroundColor: colors.accent.primary, alignItems: 'center', opacity: isSavingRoutine ? 0.6 : 1 }}
            >
              <Text style={{ color: colors.bg.primary, fontWeight: '700' }}>
                {isSavingRoutine ? t('session.history.saving') : t('common.save')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )}

    <ConfirmDialog
      visible={dialog.visible}
      title={dialog.title}
      message={dialog.message}
      confirmLabel={dialog.confirmLabel}
      cancelLabel={dialog.cancelLabel}
      destructive={dialog.destructive}
      onConfirm={dialog.onConfirm}
      onCancel={dialog.onCancel}
    />
    </>
  );
}

function SessionExerciseSummary({ sessionExercise }: { sessionExercise: SessionExercise }) {
  const { data: exercises } = useExercise(sessionExercise.exerciseId);
  const { data: sets } = useSets(sessionExercise.id);
  const router = useRouter();
  const settings = useSettings();
  const { t, i18n } = useTranslation();

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
            {exercise ? getExerciseName(exercise.name, i18n.language) : t('session.unknownExercise')}
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
              <Text style={{ fontSize: 14, color: colors.text.secondary }}>{t('session.history.setNumber', { number: set.setNumber })}</Text>
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
        <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.muted }}>{t('session.history.noSetsLogged')}</Text>
      )}
    </View>
  );
}
