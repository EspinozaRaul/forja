import { Text, View, ScrollView, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Image } from 'expo-image';
import { Directory, File, Paths } from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useExercise } from '../../lib/hooks/useExercises';
import { useExerciseStats, useExerciseSessions, useExercisePRs } from '../../lib/hooks/useExercises';
import { useTotalVolumeByWeek } from '../../lib/hooks/useProgress';
import { useSettings } from '../../lib/utils/settings';
import { ProgressChart } from '../../components/ProgressChart';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { colors, spacing, borderRadius } from '../../lib/theme/tokens';
import { formatDuration, formatRelativeDate, formatVolume } from '../../lib/utils/format';
import { resolveUnit, formatWeight } from '../../lib/utils/weight-unit';
import { EXERCISE_IMAGES } from '../../lib/assets/exercise-images';
import { EXERCISE_NAMES_ES } from '../../lib/db/exercise-names-es';

function GifPlayer({ url, visible, onClose }: { url: string; visible: boolean; onClose: () => void }) {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}
        activeOpacity={1}
        onPress={onClose}
      >
        <Text style={{ color: '#FFF', fontSize: 14, marginBottom: 12 }}>Toca para cerrar</Text>
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

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const exerciseId = parseInt(id, 10);

  const { data: exercises, isLoading: exerciseLoading } = useExercise(exerciseId);
  const { data: stats, isLoading: statsLoading } = useExerciseStats(exerciseId);
  const { data: prs, isLoading: prsLoading } = useExercisePRs(exerciseId);
  const { data: sessions, isLoading: sessionsLoading } = useExerciseSessions(exerciseId);
  const { data: volumeData, isLoading: volumeLoading } = useTotalVolumeByWeek(exerciseId);
  const settings = useSettings();
  const [showGif, setShowGif] = useState(false);

  const exercise = exercises?.[0];
  const unit = resolveUnit(exercise?.unit, settings.data.weightUnit);
  const isLoading = exerciseLoading || statsLoading || prsLoading || sessionsLoading || volumeLoading;

  if (isLoading) {
    return <LoadingSpinner message="Loading exercise..." />;
  }

  if (!exercise) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, padding: spacing.md }}>
        <EmptyState title="Exercise not found" />
      </View>
    );
  }

  const exerciseImage = exercise.originalId ? EXERCISE_IMAGES[exercise.originalId] : null;
  const gifUrl = exercise.gifUrl;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {/* Exercise Image + GIF Button */}
      {exerciseImage && (
        <View style={{ backgroundColor: colors.bg.card, alignItems: 'center', paddingVertical: spacing.lg }}>
          <Image
            source={exerciseImage}
            style={{ width: 200, height: 200, borderRadius: borderRadius.md, resizeMode: 'contain' }}
          />
          {gifUrl && (
            <TouchableOpacity
              onPress={() => setShowGif(true)}
              style={{ marginTop: spacing.sm, backgroundColor: colors.tag.muscle, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.tag.text }}>Ver animacion</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* GIF Modal */}
      {gifUrl && (
        <GifPlayer url={gifUrl} visible={showGif} onClose={() => setShowGif(false)} />
      )}

      {/* Exercise Header */}
      <View style={{ backgroundColor: colors.bg.card, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border.primary }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text.primary }}>
          {EXERCISE_NAMES_ES[exercise.name] || exercise.name}
        </Text>

        {/* Tags */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm }}>
          {exercise.muscleGroup && (
            <View style={{ backgroundColor: colors.tag.muscle, paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full }}>
              <Text style={{ fontSize: 12, color: colors.tag.text }}>{exercise.muscleGroup}</Text>
            </View>
          )}
          {exercise.equipment && (
            <View style={{ backgroundColor: colors.tag.equipment, paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full }}>
              <Text style={{ fontSize: 12, color: colors.tag.equipmentText }}>{exercise.equipment}</Text>
            </View>
          )}
        </View>

        {exercise.instructionsEs && (
          <Text style={{ fontSize: 14, color: colors.text.secondary, marginTop: spacing.md, lineHeight: 20 }}>
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
          <Text style={{ fontSize: 12, color: colors.text.muted, marginBottom: spacing.xs }}>
            Max Weight
          </Text>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.accent.primary }}>
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
          <Text style={{ fontSize: 12, color: colors.text.muted, marginBottom: spacing.xs }}>
            Total Volume
          </Text>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.accent.primary }}>
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
          <Text style={{ fontSize: 12, color: colors.text.muted, marginBottom: spacing.xs }}>
            Sessions
          </Text>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.accent.primary }}>
            {stats?.totalSessions ?? 0}
          </Text>
        </View>
      </View>

      {/* Personal Records */}
      {prs && (prs.maxWeight || prs.bestSet || prs.estimated1RM) && (
        <View style={{ backgroundColor: colors.bg.card, marginHorizontal: spacing.md, borderRadius: borderRadius.md, padding: spacing.lg }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text.primary, marginBottom: spacing.md }}>
            Personal Records
          </Text>

          <View style={{ gap: spacing.md }}>
            {prs.maxWeight && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: colors.text.secondary }}>Max Weight</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.warning }}>
                    {formatWeight(prs.maxWeight.value, unit)}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.text.muted }}>
                    {formatRelativeDate(prs.maxWeight.date)}
                  </Text>
                </View>
              </View>
            )}

            {prs.bestSet && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: colors.text.secondary }}>Best Set</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.warning }}>
                    {formatWeight(prs.bestSet.weight, unit)} × {prs.bestSet.reps}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.text.muted }}>
                    {formatRelativeDate(prs.bestSet.date)}
                  </Text>
                </View>
              </View>
            )}

            {prs.maxVolumeSession && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: colors.text.secondary }}>Best Session</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.warning }}>
                    {formatVolume(prs.maxVolumeSession.volume, unit)}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.text.muted }}>
                    {formatRelativeDate(prs.maxVolumeSession.date)}
                  </Text>
                </View>
              </View>
            )}

            {prs.estimated1RM && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: colors.text.secondary }}>Est. 1RM</Text>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.warning }}>
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
          title={`Weekly Volume (${unit})`}
          unit={unit}
        />
      </View>

      {/* Session History */}
      <View style={{ backgroundColor: colors.bg.card, marginTop: spacing.md, padding: spacing.lg }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text.primary, marginBottom: spacing.md }}>
          Session History
        </Text>

        {!sessions || sessions.length === 0 ? (
          <EmptyState
            title="No sessions yet"
            message="Start a session to see your history here."
          />
        ) : (
          sessions.map((session) => (
            <TouchableOpacity
              key={session.sessionId}
              onPress={() => router.push(`/session/history/${session.sessionId}`)}
              style={{
                backgroundColor: colors.bg.elevated,
                borderRadius: borderRadius.md,
                padding: spacing.md,
                marginBottom: spacing.sm,
              }}
            >
              {/* Session Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.primary }}>
                  {formatRelativeDate(session.startedAt)}
                </Text>
                {session.duration && (
                  <Text style={{ fontSize: 12, color: colors.text.muted }}>
                    {formatDuration(session.duration)}
                  </Text>
                )}
              </View>

              {/* Session Stats */}
              <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                <View>
                  <Text style={{ fontSize: 12, color: colors.text.muted }}>Volume</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary }}>
                    {formatVolume(session.volume, unit)}
                  </Text>
                </View>
                <View>
                  <Text style={{ fontSize: 12, color: colors.text.muted }}>Sets</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary }}>
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
