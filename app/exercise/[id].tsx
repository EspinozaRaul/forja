import { Text, View, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Image } from 'expo-image';
import { useEvent } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useExercise } from '../../lib/hooks/useExercises';
import { useExerciseStats, useExerciseSessions, useExercisePRs } from '../../lib/hooks/useExercises';
import { useTotalVolumeByWeek } from '../../lib/hooks/useProgress';
import { useSettings } from '../../lib/utils/settings';
import { ProgressChart } from '../../components/ProgressChart';
import { EmptyState } from '../../components/ui/EmptyState';
import { QueryState } from '../../components/ui/QueryState';
import { colors, spacing, borderRadius, fonts, fontSizes } from '../../lib/theme/tokens';
import { formatDuration, formatRelativeDate, formatVolume } from '../../lib/utils/format';
import { resolveUnit, formatWeight } from '../../lib/utils/weight-unit';
import { EXERCISE_IMAGES } from '../../lib/assets/exercise-images';
import { EXERCISE_VIDEOS } from '../../lib/assets/exercise-videos';
import { getExerciseName } from '../../lib/utils/exercise-names';
import i18n from '../../lib/i18n';

function RemoteGifPlayer({ url, visible, onClose }: { url: string; visible: boolean; onClose: () => void }) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    if (!visible || !url || localUri) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Build a cache path from the URL hash
        const filename = url.split('/').pop() ?? 'gif.gif';
        const cacheDir = new Directory(Paths.cache, 'exercise-gifs');
        if (!cacheDir.exists) {
          cacheDir.create({ intermediates: true });
        }
        const file = new File(cacheDir, filename);
        if (file.exists) {
          if (!cancelled) setLocalUri(file.uri);
        } else {
          const downloaded = await File.downloadFileAsync(url, file);
          if (!cancelled) setLocalUri(downloaded.uri);
        }
      } catch {
        // Fallback: try loading directly from URL
        if (!cancelled) setLocalUri(url);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, url]);

  return (
    <Modal accessible={true} visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: colors.overlay.deep, justifyContent: 'center', alignItems: 'center' }}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
      >
        <Text style={{ color: colors.text.primary, fontSize: fontSizes.sm, marginBottom: spacing.sm + spacing.xs }}>{t('exerciseDetail.tapToClose')}</Text>
        {loading ? (
          <ActivityIndicator size="large" color={colors.text.link} />
        ) : localUri ? (
          <Image
            source={{ uri: localUri }}
            style={{ width: 300, height: 300, borderRadius: borderRadius.md, resizeMode: 'contain' }}
            transition={200}
          />
        ) : null}
      </TouchableOpacity>
    </Modal>
  );
}

// Plays the bundled MP4 for the exercise. The clips are silent and only a few
// seconds long, so they loop while the modal is open.
function BundledVideoPlayer({ source, visible, onClose }: { source: number; visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    if (visible && status === 'readyToPlay') {
      player.play();
    } else {
      player.pause();
    }
  }, [visible, status, player]);

  return (
    <Modal accessible={true} visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: colors.overlay.deep, justifyContent: 'center', alignItems: 'center' }}
        activeOpacity={1}
        onPress={onClose}
        accessibilityRole="button"
      >
        <Text style={{ color: colors.text.primary, fontSize: fontSizes.sm, marginBottom: spacing.sm + spacing.xs }}>{t('exerciseDetail.tapToClose')}</Text>
        <View style={{ width: 300, height: 300, borderRadius: borderRadius.md, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
          {status === 'readyToPlay' ? (
            <VideoView
              player={player}
              style={{ width: 300, height: 300 }}
              contentFit="contain"
              nativeControls={false}
            />
          ) : (
            <ActivityIndicator size="large" color={colors.text.link} />
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// Prefers the bundled MP4 (plays offline, no network) and falls back to the
// remote-GIF cache path for exercises that have no bundled video.
function GifPlayer({ url, video, visible, onClose }: { url?: string | null; video?: number | null; visible: boolean; onClose: () => void }) {
  if (video) {
    return <BundledVideoPlayer source={video} visible={visible} onClose={onClose} />;
  }
  if (url) {
    return <RemoteGifPlayer url={url} visible={visible} onClose={onClose} />;
  }
  return null;
}

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const exerciseId = parseInt(id, 10);

  const { data: exercises, isLoading: exerciseLoading, isError: exerciseError, refetch: refetchExercise } = useExercise(exerciseId);
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useExerciseStats(exerciseId);
  const { data: prs, isLoading: prsLoading, isError: prsError, refetch: refetchPrs } = useExercisePRs(exerciseId);
  const { data: sessions, isLoading: sessionsLoading, isError: sessionsError, refetch: refetchSessions } = useExerciseSessions(exerciseId);
  const { data: volumeData, isLoading: volumeLoading, isError: volumeError, refetch: refetchVolume } = useTotalVolumeByWeek(exerciseId);
  const settings = useSettings();
  const [showGif, setShowGif] = useState(false);

  const exercise = exercises?.[0];
  const unit = resolveUnit(exercise?.unit, settings.data.weightUnit);
  const isLoading = exerciseLoading || statsLoading || prsLoading || sessionsLoading || volumeLoading;
  const hasError = exerciseError || statsError || prsError || sessionsError || volumeError;

  if (isLoading || hasError || !exercise) {
    return (
      <QueryState
        queries={[
          { isLoading: exerciseLoading, isError: exerciseError, refetch: refetchExercise },
          { isLoading: statsLoading, isError: statsError, refetch: refetchStats },
          { isLoading: prsLoading, isError: prsError, refetch: refetchPrs },
          { isLoading: sessionsLoading, isError: sessionsError, refetch: refetchSessions },
          { isLoading: volumeLoading, isError: volumeError, refetch: refetchVolume },
        ]}
        loadingMessage={t('exerciseDetail.loading')}
        empty
        emptyTitle={t('exerciseDetail.notFound')}
      >
        {null}
      </QueryState>
    );
  }

  const exerciseImage = exercise.originalId ? EXERCISE_IMAGES[exercise.originalId] : null;
  const bundledVideo = exercise.originalId ? EXERCISE_VIDEOS[exercise.originalId] : null;
  const gifUrl = exercise.gifUrl;
  const hasAnimation = Boolean(bundledVideo || gifUrl);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {/* Exercise Image + GIF Button */}
      {exerciseImage && (
        <View style={{ backgroundColor: colors.bg.card, alignItems: 'center', paddingVertical: spacing.lg }}>
          <Image
            source={exerciseImage}
            style={{ width: 200, height: 200, borderRadius: borderRadius.md, resizeMode: 'contain' }}
          />
          {hasAnimation && (
            <TouchableOpacity
              onPress={() => setShowGif(true)}
              accessibilityRole="button"
              style={{ marginTop: spacing.sm, backgroundColor: colors.tag.muscle, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full }}
            >
              <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodySemiBold, color: colors.tag.text }}>{t('exerciseDetail.viewAnimation')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Animation Modal */}
      {hasAnimation && (
        <GifPlayer url={gifUrl} video={bundledVideo} visible={showGif} onClose={() => setShowGif(false)} />
      )}

      {/* Exercise Header */}
      <View style={{ backgroundColor: colors.bg.card, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border.primary }}>
        <Text style={{ fontSize: fontSizes.xl, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
          {getExerciseName(exercise.name, i18n.language)}
        </Text>

        {/* Tags */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm }}>
          {exercise.muscleGroup && (
            <View style={{ backgroundColor: colors.tag.muscle, paddingHorizontal: spacing.sm + spacing.xxs, paddingVertical: spacing.xs, borderRadius: borderRadius.full }}>
              <Text style={{ fontSize: fontSizes.xs, color: colors.tag.text }}>{exercise.muscleGroup}</Text>
            </View>
          )}
          {exercise.equipment && (
            <View style={{ backgroundColor: colors.tag.equipment, paddingHorizontal: spacing.sm + spacing.xxs, paddingVertical: spacing.xs, borderRadius: borderRadius.full }}>
              <Text style={{ fontSize: fontSizes.xs, color: colors.tag.equipmentText }}>{exercise.equipment}</Text>
            </View>
          )}
        </View>

        {exercise.instructionsEs && (
          <Text style={{ fontSize: fontSizes.md, color: colors.text.secondary, marginTop: spacing.md, lineHeight: 20 }}>
            {exercise.instructionsEs}
          </Text>
        )}
      </View>

      {/* Stats Cards */}
      <View style={{ flexDirection: 'row', padding: spacing.md, gap: spacing.sm }}>
        <View style={{
          flex: 1,
          backgroundColor: colors.bg.card,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted, marginBottom: spacing.xs }}>
            {t('exerciseDetail.maxWeight')}
          </Text>
          <Text style={{ fontSize: fontSizes.xl, fontFamily: fonts.bodySemiBold, color: colors.accent.primary }}>
            {stats?.maxWeight ? formatWeight(stats.maxWeight, unit) : '-'}
          </Text>
        </View>

        <View style={{
          flex: 1,
          backgroundColor: colors.bg.card,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted, marginBottom: spacing.xs }}>
            {t('exerciseDetail.totalVolume')}
          </Text>
          <Text style={{ fontSize: fontSizes.xl, fontFamily: fonts.bodySemiBold, color: colors.accent.primary }}>
            {stats?.totalVolume ? formatVolume(stats.totalVolume, unit) : '0'}
          </Text>
        </View>

        <View style={{
          flex: 1,
          backgroundColor: colors.bg.card,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          alignItems: 'center',
        }}>
          <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted, marginBottom: spacing.xs }}>
            {t('exerciseDetail.sessions')}
          </Text>
          <Text style={{ fontSize: fontSizes.xl, fontFamily: fonts.bodySemiBold, color: colors.accent.primary }}>
            {stats?.totalSessions ?? 0}
          </Text>
        </View>
      </View>

      {/* Personal Records */}
      {prs && (prs.maxWeight || prs.bestSet || prs.estimated1RM) && (
        <View style={{ backgroundColor: colors.bg.card, marginHorizontal: spacing.md, borderRadius: borderRadius.md, padding: spacing.lg }}>
          <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md }}>
            {t('exerciseDetail.personalRecords')}
          </Text>

          <View style={{ gap: spacing.md }}>
            {prs.maxWeight && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: fontSizes.md, color: colors.text.secondary }}>{t('exerciseDetail.maxWeight')}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.warning }}>
                    {formatWeight(prs.maxWeight.value, unit)}
                  </Text>
                  <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted }}>
                    {formatRelativeDate(prs.maxWeight.date)}
                  </Text>
                </View>
              </View>
            )}

            {prs.bestSet && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: fontSizes.md, color: colors.text.secondary }}>{t('exerciseDetail.bestSet')}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.warning }}>
                    {formatWeight(prs.bestSet.weight, unit)} × {prs.bestSet.reps}
                  </Text>
                  <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted }}>
                    {formatRelativeDate(prs.bestSet.date)}
                  </Text>
                </View>
              </View>
            )}

            {prs.maxVolumeSession && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: fontSizes.md, color: colors.text.secondary }}>{t('exerciseDetail.bestSession')}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.warning }}>
                    {formatVolume(prs.maxVolumeSession.volume, unit)}
                  </Text>
                  <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted }}>
                    {formatRelativeDate(prs.maxVolumeSession.date)}
                  </Text>
                </View>
              </View>
            )}

            {prs.estimated1RM && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: fontSizes.md, color: colors.text.secondary }}>{t('exerciseDetail.est1RM')}</Text>
                <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.warning }}>
                  {formatWeight(prs.estimated1RM, unit)}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Progress Chart */}
      <View style={{ padding: spacing.md }}>
        <ProgressChart
          data={volumeData ?? []}
          title={t('exerciseDetail.weeklyVolume', { unit })}
          unit={unit}
        />
      </View>

      {/* Session History */}
      <View style={{ backgroundColor: colors.bg.card, marginTop: spacing.md, padding: spacing.lg }}>
        <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md }}>
          {t('exerciseDetail.sessionHistory')}
        </Text>

        {!sessions || sessions.length === 0 ? (
          <EmptyState
            title={t('exerciseDetail.noSessions')}
            message={t('exerciseDetail.noSessionsMessage')}
          />
        ) : (
          sessions.map((session) => (
            <TouchableOpacity
              key={session.sessionId}
              onPress={() => router.push(`/session/history/${session.sessionId}`)}
              accessibilityRole="button"
              style={{
                backgroundColor: colors.bg.elevated,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginBottom: spacing.sm,
              }}
            >
              {/* Session Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
                  {formatRelativeDate(session.startedAt)}
                </Text>
                {session.duration && (
                  <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted }}>
                    {formatDuration(session.duration)}
                  </Text>
                )}
              </View>

              {/* Session Stats */}
              <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                <View>
                  <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted }}>{t('progress.volume')}</Text>
                  <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.secondary }}>
                    {formatVolume(session.volume, unit)}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted }}>{t('progress.sets')}</Text>
                  <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.secondary }}>
                    {session.completedSets}/{session.setCount}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Bottom spacer */}
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}
