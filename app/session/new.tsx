import { Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCreateSession, useAddExerciseToSession, useLastSessionForRoutine } from '../../lib/hooks/useSessions';
import { useCreateSet } from '../../lib/hooks/useSets';
import { useRoutine, useRoutineExercises } from '../../lib/hooks/useRoutines';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { colors, spacing, borderRadius, fonts, fontSizes } from '../../lib/theme/tokens';
import { haptics } from '../../lib/utils/haptics';
import { DEFAULT_TARGET_SETS } from '../../lib/constants/routine-defaults';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../../lib/hooks/useConfirmDialog';
import { useTranslation } from 'react-i18next';

export default function NewSessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { routineId } = useLocalSearchParams<{ routineId?: string }>();
  const createSession = useCreateSession();

  const routineIdNum = routineId ? parseInt(routineId, 10) : undefined;

  // Guard against NaN from malformed route params
  if (routineId && isNaN(routineIdNum!)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.text.primary, fontSize: fontSizes.lg }}>{t('common.invalidId')}</Text>
      </View>
    );
  }

  const { data: routines, isLoading: routineLoading } = useRoutine(routineIdNum ?? 0);
  const { data: routineExercises, isLoading: exercisesLoading } = useRoutineExercises(routineIdNum ?? 0);
  const { data: lastSession } = useLastSessionForRoutine(routineIdNum ?? 0);
  const addExerciseToSession = useAddExerciseToSession();
  const createSet = useCreateSet();
  const { dialog, showAlert } = useConfirmDialog();

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
          // Batch create all sets for this exercise in parallel
          const setPromises = [];
          for (let i = 1; i <= plannedSets; i++) {
            setPromises.push(
              createSet.mutateAsync({
                sessionExerciseId,
                setNumber: i,
              })
            );
          }
          await Promise.all(setPromises);
        }
      }

      router.replace(`/session/${session[0].id}`);
    } catch (error) {
      await haptics.error();
      showAlert(t('common.error'), t('session.new.createFailed'));
    }
  };

  if (isLoading) {
    return <LoadingSpinner message={t('session.new.loadingRoutine')} />;
  }

  return (
    <>
    <View style={{ flex: 1, backgroundColor: colors.bg.primary, padding: spacing.md, paddingBottom: insets.bottom + spacing.md }} className="flex-1 bg-dark-bg p-4">
      <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md }} className="text-lg font-semibold text-dark-text-primary mb-4">{t('session.new.title')}</Text>
      
      {routine ? (
        <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.sm, padding: spacing.md, marginBottom: spacing.md }} className="bg-dark-card rounded-lg p-4 mb-4">
          <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary }} className="text-base font-medium text-dark-text-primary">{routine.name}</Text>
          {routine.description && (
            <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.body, color: colors.text.secondary, marginTop: spacing.xs }} className="text-sm text-dark-text-secondary mt-1">{routine.description}</Text>
          )}
          <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.body, color: colors.text.secondary, marginTop: spacing.sm }} className="text-sm text-dark-text-secondary mt-2">
            {t('session.new.exerciseCount', { count: routineExercises?.length ?? 0 })}
          </Text>
        </View>
      ) : (
        <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.sm, padding: spacing.md, marginBottom: spacing.md }} className="bg-dark-card rounded-lg p-4 mb-4">
          <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary }} className="text-base font-medium text-dark-text-primary">{t('session.new.emptySession')}</Text>
          <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.body, color: colors.text.secondary, marginTop: spacing.xs }} className="text-sm text-dark-text-secondary mt-1">
            {t('session.new.emptySessionMessage')}
          </Text>
        </View>
      )}

      <Button
        title={t('session.new.startButton')}
        onPress={handleStartSession}
        loading={createSession.isPending}
      />
    </View>
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