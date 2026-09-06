import { Text, View, ScrollView, TouchableOpacity, Modal, Pressable, StyleSheet } from 'react-native';
import { useState, useMemo, useCallback } from 'react';
import type { Exercise } from '../../lib/types';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSessions } from '../../lib/hooks/useSessions';
import { useRoutines, useRoutineExercises } from '../../lib/hooks/useRoutines';
import { useExercises, useLastWorkoutPerExercise } from '../../lib/hooks/useExercises';
import { useCreateSession, useAddExerciseToSession, useLastSessionForRoutine, useActiveSession, useDeleteSession } from '../../lib/hooks/useSessions';
import { useGlobalStats } from '../../lib/hooks/useGlobalStats';
import { SessionCard } from '../../components/SessionCard';
import { ActiveSessionBar } from '../../components/ActiveSessionBar';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { AnimatedListItem } from '../../components/ui/AnimatedListItem';
import { colors, spacing, borderRadius, fonts } from '../../lib/theme/tokens';
import { haptics } from '../../lib/utils/haptics';
import { useSettings } from '../../lib/utils/settings';
import { resolveUnit, formatWeight } from '../../lib/utils/weight-unit';
import { getExerciseName } from '../../lib/utils/exercise-names';
import { DEFAULT_TARGET_SETS, formatSetsRepsLabel } from '../../lib/constants/routine-defaults';
import { useCreateSet } from '../../lib/hooks/useSets';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../../lib/hooks/useConfirmDialog';
import { ExercisePicker } from '../../components/ExercisePicker';

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { data: sessions, isLoading: sessionsLoading } = useSessions();
  const { data: routines, isLoading: routinesLoading } = useRoutines();
  const { data: globalStats, isLoading: statsLoading } = useGlobalStats();

  const [selectedRoutineId, setSelectedRoutineId] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const { data: routineExercises, isLoading: exercisesLoading } = useRoutineExercises(selectedRoutineId ?? 0);
  const { data: allExercises } = useExercises();
  const lastWorkout = useLastWorkoutPerExercise(routineExercises?.map((re) => re.exerciseId) ?? []);
  const { data: lastSession } = useLastSessionForRoutine(selectedRoutineId ?? 0);
  const settings = useSettings();
  const settingsUnit = settings.data.weightUnit;
  const createSession = useCreateSession();
  const addExerciseToSession = useAddExerciseToSession();
  const createSet = useCreateSet();
  const { dialog, showAlert, showConfirm } = useConfirmDialog();
  const { data: activeSession } = useActiveSession();
  const deleteSession = useDeleteSession();

  const activeRoutineName = useMemo(() => {
    if (!activeSession?.routineId || !routines) return null;
    return routines.find((r) => r.id === activeSession.routineId)?.name ?? null;
  }, [activeSession?.routineId, routines]);

  const isLoading = sessionsLoading || routinesLoading || statsLoading;

  // Stats — compute once per render, not per filter iteration
  const totalSessions = sessions?.length ?? 0;
  const thisWeekSessions = useMemo(() => {
    if (!sessions) return 0;
    const now = new Date();
    return sessions.filter((s) => {
      const sessionDate = new Date(s.startedAt);
      const diffDays = (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= 7;
    }).length;
  }, [sessions]);

  // Recent sessions (last 5)
  const recentSessions = sessions?.slice(0, 5) ?? [];

  const handleStartEmptySession = async () => {
    try {
      await haptics.success();
      setShowPicker(true);
    } catch (error) {
      await haptics.error();
      showAlert(t('common.error'), t('tabs.home.failedToCreateSession'));
    }
  };

  const handleNewSessionWithExercises = async (selectedExercises: Exercise[]) => {
    setShowPicker(false);
    try {
      await haptics.success();
      const newSession = await createSession.mutateAsync({});
      for (const [index, exercise] of selectedExercises.entries()) {
        await addExerciseToSession.mutateAsync({
          sessionId: newSession[0].id,
          exerciseId: exercise.id,
          order: index,
        });
      }
      router.push(`/session/${newSession[0].id}`);
    } catch (error) {
      await haptics.error();
      showAlert(t('common.error'), t('tabs.home.failedToCreateSession'));
    }
  };

  const handleRoutinePress = useCallback((routineId: number) => {
    setSelectedRoutineId(routineId);
  }, []);

  const handleStartRoutineSession = async () => {
    if (!selectedRoutineId) return;
    try {
      await haptics.success();
      const session = await createSession.mutateAsync({
        routineId: selectedRoutineId,
      });

      // Copy routine exercises to the new session (fresh start) with the
      // planned set template already materialized (empty sets guide the user).
      // Also copy notes from the last session (seat height, pain notes, etc.)
      if (routineExercises && routineExercises.length > 0) {
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

      setSelectedRoutineId(null);
      router.push(`/session/${session[0].id}`);
    } catch (error) {
      await haptics.error();
      showAlert(t('common.error'), t('tabs.home.failedToCreateSession'));
    }
  };

  const handleDiscardSession = () => {
    if (!activeSession) return;
    showConfirm(
      t('session.confirm.discardSessionTitle'),
      t('session.confirm.discardSessionMessage'),
      async () => {
        try {
          try {
            const { clearSessionTimer } = await import('../../lib/utils/timer-persistence');
            await clearSessionTimer();
          } catch (_) {
            // timer persistence may not exist yet — safe to ignore
          }
          await deleteSession.mutateAsync(activeSession.id);
        } catch (e) {
          console.error('Failed to discard session:', e);
          await haptics.error();
          showAlert(t('common.error'), t('session.new.createFailed'));
        }
      },
      { confirmLabel: t('common.delete'), cancelLabel: t('common.cancel'), destructive: true }
    );
  };

  const handleResumeSession = () => {
    if (!activeSession) return;
    router.push(`/session/${activeSession.id}`);
  };

  const selectedRoutine = routines?.find((r) => r.id === selectedRoutineId);

  const routineExercisesWithDetails = useMemo(() => {
    if (!routineExercises) return [];
    const exerciseMap = new Map(allExercises?.map((e) => [e.id, e]) ?? []);
    return routineExercises
      .map((re) => ({ ...re, exercise: exerciseMap.get(re.exerciseId) }))
      .sort((a, b) => a.order - b.order);
  }, [routineExercises, allExercises]);

  if (isLoading) {
    return <LoadingSpinner message={t('tabs.home.loadingDashboard')} />;
  }

  return (
    <>
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {/* Stats Dashboard */}
      <View style={styles.cardWithTopMargin}>
        <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md }}>{t('tabs.home.stats')}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1, backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border.primary }}>
            <Text style={{ fontSize: 11, fontFamily: fonts.bodyMedium, color: colors.text.muted, marginBottom: 4 }}>{t('tabs.home.workouts')}</Text>
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.accent.primary }}>
              {globalStats?.totalWorkouts ?? 0}
            </Text>
          </View>
          <View style={{ flex: 1, backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border.primary }}>
            <Text style={{ fontSize: 11, fontFamily: fonts.bodyMedium, color: colors.text.muted, marginBottom: 4 }}>{t('tabs.home.streak')}</Text>
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.warning }}>
              {globalStats?.currentStreak ?? 0}d
            </Text>
          </View>
        </View>
        {globalStats?.mostFrequentExercise && (
          <TouchableOpacity
            onPress={() => {
              const ex = allExercises?.find((e) => e.name === globalStats.mostFrequentExercise);
              if (ex) router.push(`/progress/exercise-detail/${ex.id}`);
            }}
            style={{ marginTop: spacing.sm, backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border.primary }}
          >
            <Text style={{ fontSize: 11, fontFamily: fonts.bodyMedium, color: colors.text.muted, marginBottom: 2 }}>{t('tabs.home.mostFrequent')}</Text>
            <Text style={{ fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.accent.primary }}>
              {getExerciseName(globalStats.mostFrequentExercise, i18n.language)} →
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Quick Start — compact, below routines */}
      <View style={styles.card}>
        <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.sm }}>{t('tabs.home.quickStart')}</Text>
        <Button title={t('tabs.home.newSession')} onPress={handleStartEmptySession} compact />
      </View>

      {/* Recent Sessions */}
      <View style={styles.cardBottomMargin}>
        <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md }}>{t('tabs.home.recentSessions')}</Text>
        {recentSessions.length === 0 ? (
          <EmptyState
            title={t('tabs.home.noSessions')}
            message={t('tabs.home.noSessionsMessage')}
          />
        ) : (
          recentSessions.map((session, index) => {
            const routine = routines?.find((r) => r.id === session.routineId);
            return (
              <AnimatedListItem key={session.id} index={index} delay={100}>
                <TouchableOpacity
                  onPress={() => router.push(`/session/history/${session.id}`)}
                  style={{ marginBottom: spacing.sm }}
                >
                  <SessionCard session={session} routineName={routine?.name} />
                </TouchableOpacity>
              </AnimatedListItem>
            );
          })
        )}
        {recentSessions.length > 0 && (
          <View style={{ marginTop: spacing.sm }}>
            <Button
              title={t('tabs.home.viewAllSessions')}
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
          style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}
          onPress={() => setSelectedRoutineId(null)}
        >
          <Pressable
            style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.lg, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: colors.border.primary }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary, flex: 1 }}>
                {selectedRoutine?.name ?? t('tabs.home.startSession')}
              </Text>
              <TouchableOpacity onPress={() => setSelectedRoutineId(null)} style={{ padding: spacing.xs }}>
                <Text style={{ fontSize: 18, color: colors.text.muted }}>✕</Text>
              </TouchableOpacity>
            </View>
            {selectedRoutine?.description && (
              <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.secondary, marginBottom: spacing.sm }}>{selectedRoutine.description}</Text>
            )}
            {exercisesLoading ? (
              <LoadingSpinner message={t('tabs.home.loadingExercises')} />
            ) : (
              <>
                {routineExercisesWithDetails.length === 0 ? (
                  <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.secondary, marginBottom: spacing.md }}>
                    {t('tabs.home.noExercisesInRoutine')}
                  </Text>
                ) : (
                  <View style={{ marginBottom: spacing.md }}>
                    {routineExercisesWithDetails.map((re) => {
                      const entry = re.exercise ? lastWorkout.data?.[re.exercise.id] : undefined;
                      const label = entry
                        ? `${entry.sets} sets${entry.reps != null ? ` × ${entry.reps} reps` : ''}${entry.weight != null ? ` · ${t('tabs.home.lastWeight')}: ${formatWeight(entry.weight, resolveUnit(entry.unit, settingsUnit))}` : ''}`
                        : formatSetsRepsLabel(re.targetSets, re.targetReps);
                      return (
                        <View key={re.id} style={{ backgroundColor: colors.bg.elevated, borderRadius: borderRadius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, marginBottom: 3, borderWidth: 1, borderColor: colors.border.primary }}>
                          <Text style={{ fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
                            {re.exercise ? getExerciseName(re.exercise.name, i18n.language) : t('tabs.home.unknownExercise')}
                          </Text>
                          <Text style={{ fontSize: 12, fontFamily: fonts.body, color: colors.text.secondary, marginTop: 1 }}>
                            {label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
                <Button title={t('tabs.home.startSession')} onPress={handleStartRoutineSession} loading={createSession.isPending} />
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
    {activeSession && (
      <ActiveSessionBar
        session={activeSession}
        routineName={activeRoutineName}
        onResume={handleResumeSession}
        onDiscard={handleDiscardSession}
      />
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
    <ExercisePicker
      visible={showPicker}
      exercises={allExercises ?? []}
      onSelect={() => {}}
      onClose={() => setShowPicker(false)}
      mode="multi"
      onMultiSelect={handleNewSessionWithExercises}
    />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card,
    padding: spacing.md + spacing.xs,
    marginBottom: 12,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
  },
  cardWithTopMargin: {
    backgroundColor: colors.bg.card,
    padding: spacing.md + spacing.xs,
    marginBottom: 12,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
  },
  cardBottomMargin: {
    backgroundColor: colors.bg.card,
    padding: spacing.md + spacing.xs,
    marginBottom: 24,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
  },
});
