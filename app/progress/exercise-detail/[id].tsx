import { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useExercise, useExerciseStats, useExerciseSessions, useExercisePRs } from '../../../lib/hooks/useExercises';
import { useExerciseProgress, useTotalVolumeByWeek } from '../../../lib/hooks/useProgress';
import { getExerciseProgressionData } from '../../../lib/db/queries';
import { ExerciseProgressChart } from '../../../components/ExerciseProgressChart';
import { ProgressChart } from '../../../components/ProgressChart';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { colors, spacing, borderRadius, fonts, fontSizes, borderWidths } from '../../../lib/theme/tokens';
import { formatRelativeDate, formatDuration, formatVolume } from '../../../lib/utils/format';
import { resolveUnit, formatWeight } from '../../../lib/utils/weight-unit';
import { getExerciseName } from '../../../lib/utils/exercise-names';
import { useSettings } from '../../../lib/utils/settings';
import type { ExerciseProgressionDataPoint } from '../../../lib/db/queries';
import { useQuery } from '@tanstack/react-query';

// ─── Date Range Type ──────────────────────────────────────
type DateRange = '4w' | '12w' | 'all';

// ─── Helpers ──────────────────────────────────────────────

function filterSessionsByDateRange<T extends { startedAt: Date }>(
  sessions: T[],
  range: DateRange
): T[] {
  if (range === 'all') return sessions;

  const now = new Date();
  const weeks = range === '4w' ? 4 : 12;
  const cutoff = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);

  return sessions.filter((s) => new Date(s.startedAt) >= cutoff);
}

function filterProgressionByDateRange(
  data: ExerciseProgressionDataPoint[],
  range: DateRange
): ExerciseProgressionDataPoint[] {
  if (range === 'all') return data;

  const now = new Date();
  const weeks = range === '4w' ? 4 : 12;
  const cutoff = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);

  return data.filter((d) => new Date(d.date) >= cutoff);
}

function filterVolumeByDateRange(
  data: Array<{ date: string; value: number }>,
  range: DateRange
): typeof data {
  if (range === 'all') return data;

  const now = new Date();
  const weeks = range === '4w' ? 4 : 12;
  const cutoff = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);

  return data.filter((d) => {
    // Date format is "YYYY-WW", approximate filtering
    const dateStr = d.date;
    const [year, week] = dateStr.split('-').map(Number);
    const date = new Date(year, 0, 1 + (week - 1) * 7);
    return date >= cutoff;
  });
}

// ─── Date Range Selector Component ─────────────────────────

function DateRangeSelector({
  selected,
  onChange,
}: {
  selected: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const { t } = useTranslation();
  const ranges: DateRange[] = ['4w', '12w', 'all'];
  
  const getDateRangeLabel = (range: DateRange): string => {
    switch (range) {
      case '4w':
        return t('progress.range4weeks');
      case '12w':
        return t('progress.range12weeks');
      case 'all':
        return t('progress.rangeAll');
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.bg.card,
        borderRadius: borderRadius.md,
        borderWidth: borderWidths.thin,
        borderColor: colors.border.primary,
        padding: spacing.xs,
        gap: spacing.xs,
      }}
    >
      {ranges.map((range) => (
        <Pressable
          key={range}
          onPress={() => onChange(range)}
          style={{
            flex: 1,
            paddingVertical: spacing.sm,
            alignItems: 'center',
            borderRadius: borderRadius.sm,
            backgroundColor: selected === range ? colors.accent.primary : 'transparent',
          }}
        >
          <Text
            style={{
              fontSize: fontSizes.sm,
              fontFamily: selected === range ? fonts.bodySemiBold : fonts.body,
              color: selected === range ? colors.bg.primary : colors.text.secondary,
            }}
          >
            {getDateRangeLabel(range)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Stats Card Component ──────────────────────────────────

function StatsCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg.card,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontSize: fontSizes.xs,
          fontFamily: fonts.body,
          color: colors.text.muted,
          marginBottom: spacing.xs,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: fontSizes.lg,
          fontFamily: fonts.bodySemiBold,
          color: colors.accent.primary,
        }}
      >
        {value ?? '-'}{unit ? ` ${unit}` : ''}
      </Text>
    </View>
  );
}

// ─── PR Row Component ──────────────────────────────────────

function PRRow({
  label,
  value,
  date,
}: {
  label: string;
  value: string;
  date?: Date;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.border.divider,
      }}
    >
      <Text
        style={{
          fontSize: fontSizes.md,
          fontFamily: fonts.body,
          color: colors.text.secondary,
        }}
      >
        {label}
      </Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text
          style={{
            fontSize: fontSizes.md,
            fontFamily: fonts.bodySemiBold,
            color: colors.warning,
          }}
        >
          {value}
        </Text>
        {date && (
          <Text
            style={{
              fontSize: fontSizes.xs,
              fontFamily: fonts.body,
              color: colors.text.muted,
              marginTop: spacing.xxs,
            }}
          >
            {formatRelativeDate(date)}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const settings = useSettings();
  const unit = settings.data.weightUnit;

  const exerciseId = parseInt(id, 10);
  const [dateRange, setDateRange] = useState<DateRange>('all');

  // Fetch exercise data
  const { data: exercises, isLoading: exerciseLoading } = useExercise(exerciseId);
  const { data: stats, isLoading: statsLoading } = useExerciseStats(exerciseId);
  const { data: sessions, isLoading: sessionsLoading } = useExerciseSessions(exerciseId);
  const { data: prs, isLoading: prsLoading } = useExercisePRs(exerciseId);
  const { data: volumeData, isLoading: volumeLoading } = useTotalVolumeByWeek(exerciseId);

  // Fetch progression data for bubble chart
  const { data: progressionData, isLoading: progressionLoading } = useQuery<ExerciseProgressionDataPoint[]>({
    queryKey: ['progression', exerciseId],
    queryFn: () => getExerciseProgressionData(exerciseId),
    enabled: !!exerciseId,
  });

  const exercise = exercises?.[0];
  const exerciseUnit = resolveUnit(exercise?.unit, unit);
  const isLoading = exerciseLoading || statsLoading || sessionsLoading || prsLoading || volumeLoading || progressionLoading;

  // Filter data by date range
  const filteredSessions = useMemo(
    () => filterSessionsByDateRange(sessions ?? [], dateRange),
    [sessions, dateRange]
  );

  const filteredProgression = useMemo(
    () => filterProgressionByDateRange(progressionData ?? [], dateRange),
    [progressionData, dateRange]
  );

  const filteredVolume = useMemo(
    () => filterVolumeByDateRange(volumeData ?? [], dateRange),
    [volumeData, dateRange]
  );

  // Calculate delta indicators
  const delta = useMemo(() => {
    if (!sessions || sessions.length < 2) return null;

    const recent = sessions.slice(0, Math.min(5, sessions.length));
    const older = sessions.slice(Math.min(5, sessions.length), Math.min(10, sessions.length));

    if (older.length === 0) return null;

    const recentAvgVolume = recent.reduce((sum, s) => sum + s.volume, 0) / recent.length;
    const olderAvgVolume = older.reduce((sum, s) => sum + s.volume, 0) / older.length;

    const volumeChange = olderAvgVolume > 0
      ? ((recentAvgVolume - olderAvgVolume) / olderAvgVolume) * 100
      : 0;

    return {
      volumeChange: Math.round(volumeChange),
    };
  }, [sessions]);

  if (isLoading) {
    return <LoadingSpinner message={t('exerciseDetail.loading')} />;
  }

  if (!exercise) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
        <EmptyState
          icon={<Ionicons name="alert-circle-outline" size={48} color={colors.error} />}
          title={t('exerciseDetail.notFound')}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.lg,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border.divider,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={{ padding: spacing.xs }}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text.primary} />
        </Pressable>
        <Ionicons name="barbell" size={20} color={colors.accent.primary} />
        <Text
          style={{
            flex: 1,
            fontSize: fontSizes.lg,
            fontFamily: fonts.bodySemiBold,
            color: colors.text.primary,
          }}
          numberOfLines={1}
        >
          {getExerciseName(exercise.name, i18n.language)}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl }}
      >
        {/* Date Range Selector */}
        <DateRangeSelector selected={dateRange} onChange={setDateRange} />

        {/* Stats Cards */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <StatsCard
            label={t('exerciseDetail.totalSessions')}
            value={stats?.totalSessions ?? 0}
          />
          <StatsCard
            label={t('exerciseDetail.maxWeight')}
            value={stats?.maxWeight ? formatWeight(stats.maxWeight, exerciseUnit) : '-'}
          />
          <StatsCard
            label={t('exerciseDetail.totalVolume')}
            value={stats?.totalVolume ? formatVolume(stats.totalVolume, exerciseUnit) : '0'}
          />
        </View>

        {/* Delta Indicator */}
        {delta && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              backgroundColor: colors.bg.card,
              borderRadius: borderRadius.md,
              borderWidth: borderWidths.thin,
              borderColor: colors.border.primary,
              padding: spacing.md,
            }}
          >
            <Ionicons
              name={delta.volumeChange >= 0 ? 'trending-up' : 'trending-down'}
              size={20}
              color={delta.volumeChange >= 0 ? colors.success : colors.error}
            />
            <Text
              style={{
                flex: 1,
                fontSize: fontSizes.sm,
                fontFamily: fonts.body,
                color: colors.text.secondary,
              }}
            >
              {t('exercises.volumeChange', {
                percent: Math.abs(delta.volumeChange),
                direction: delta.volumeChange >= 0 ? 'up' : 'down',
              })}
            </Text>
          </View>
        )}

        {/* Progression Chart */}
        <View
          style={{
            backgroundColor: colors.bg.card,
            borderRadius: borderRadius.lg,
            borderWidth: borderWidths.thin,
            borderColor: colors.border.primary,
            padding: spacing.md,
          }}
        >
          <Text
            style={{
              fontSize: fontSizes.md,
              fontFamily: fonts.bodySemiBold,
              color: colors.text.primary,
              marginBottom: spacing.md,
            }}
          >
            {t('exerciseDetail.progression')}
          </Text>
          <ExerciseProgressChart
            data={filteredProgression}
            unit={exerciseUnit}
          />
        </View>

        {/* Volume Chart */}
        <View
          style={{
            backgroundColor: colors.bg.card,
            borderRadius: borderRadius.lg,
            borderWidth: borderWidths.thin,
            borderColor: colors.border.primary,
            padding: spacing.md,
          }}
        >
          <Text
            style={{
              fontSize: fontSizes.md,
              fontFamily: fonts.bodySemiBold,
              color: colors.text.primary,
              marginBottom: spacing.md,
            }}
          >
            {t('exerciseDetail.weeklyVolume')}
          </Text>
          <ProgressChart
            data={filteredVolume}
            unit={exerciseUnit}
          />
        </View>

        {/* Personal Records */}
        {prs && (prs.maxWeight || prs.bestSet || prs.maxVolumeSession || prs.estimated1RM) && (
          <View
            style={{
              backgroundColor: colors.bg.card,
              borderRadius: borderRadius.lg,
              borderWidth: borderWidths.thin,
              borderColor: colors.border.primary,
              padding: spacing.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
              <Ionicons name="trophy" size={18} color={colors.warning} />
              <Text
                style={{
                  fontSize: fontSizes.md,
                  fontFamily: fonts.bodySemiBold,
                  color: colors.text.primary,
                }}
              >
                {t('exerciseDetail.personalRecords')}
              </Text>
            </View>

            {prs.maxWeight && (
              <PRRow
                label={t('exerciseDetail.maxWeight')}
                value={formatWeight(prs.maxWeight.value, exerciseUnit)}
                date={prs.maxWeight.date}
              />
            )}

            {prs.bestSet && (
              <PRRow
                label={t('exerciseDetail.bestSet')}
                value={`${formatWeight(prs.bestSet.weight, exerciseUnit)} × ${prs.bestSet.reps}`}
                date={prs.bestSet.date}
              />
            )}

            {prs.maxVolumeSession && (
              <PRRow
                label={t('exerciseDetail.bestSession')}
                value={formatVolume(prs.maxVolumeSession.volume, exerciseUnit)}
                date={prs.maxVolumeSession.date}
              />
            )}

            {prs.estimated1RM && (
              <PRRow
                label={t('exerciseDetail.est1RM')}
                value={formatWeight(prs.estimated1RM, exerciseUnit)}
              />
            )}
          </View>
        )}

        {/* Session History */}
        <View
          style={{
            backgroundColor: colors.bg.card,
            borderRadius: borderRadius.lg,
            borderWidth: borderWidths.thin,
            borderColor: colors.border.primary,
            padding: spacing.md,
          }}
        >
          <Text
            style={{
              fontSize: fontSizes.md,
              fontFamily: fonts.bodySemiBold,
              color: colors.text.primary,
              marginBottom: spacing.md,
            }}
          >
            {t('exerciseDetail.sessionHistory')}
          </Text>

          {filteredSessions.length === 0 ? (
            <EmptyState
              icon={<Ionicons name="calendar-outline" size={32} color={colors.text.muted} />}
              title={t('exerciseDetail.noSessions')}
              message={t('exerciseDetail.noSessionsMessage')}
            />
          ) : (
            filteredSessions.map((session) => (
              <Pressable
                key={session.sessionId}
                onPress={() => router.push(`/session/history/${session.sessionId}`)}
                style={{
                  backgroundColor: colors.bg.elevated,
                  borderRadius: borderRadius.md,
                  borderWidth: borderWidths.thin,
                  borderColor: colors.border.primary,
                  padding: spacing.md,
                  marginBottom: spacing.sm,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: spacing.xs,
                  }}
                >
                  <Text
                    style={{
                      fontSize: fontSizes.sm,
                      fontFamily: fonts.bodySemiBold,
                      color: colors.text.primary,
                    }}
                  >
                    {formatRelativeDate(session.startedAt)}
                  </Text>
                  {session.duration && (
                    <Text
                      style={{
                        fontSize: fontSizes.xs,
                        fontFamily: fonts.body,
                        color: colors.text.muted,
                      }}
                    >
                      {formatDuration(session.duration)}
                    </Text>
                  )}
                </View>

                <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                  <View>
                    <Text
                      style={{
                        fontSize: fontSizes.xs,
                        fontFamily: fonts.body,
                        color: colors.text.muted,
                      }}
                    >
                      {t('exercises.volume')}
                    </Text>
                    <Text
                      style={{
                        fontSize: fontSizes.sm,
                        fontFamily: fonts.bodyMedium,
                        color: colors.text.secondary,
                      }}
                    >
                      {formatVolume(session.volume, exerciseUnit)}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={{
                        fontSize: fontSizes.xs,
                        fontFamily: fonts.body,
                        color: colors.text.muted,
                      }}
                    >
                      {t('exercises.sets')}
                    </Text>
                    <Text
                      style={{
                        fontSize: fontSizes.sm,
                        fontFamily: fonts.bodyMedium,
                        color: colors.text.secondary,
                      }}
                    >
                      {session.completedSets}/{session.setCount}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </View>

        {/* Bottom spacer */}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}
