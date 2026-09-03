import { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useGlobalStats } from '../../lib/hooks/useGlobalStats';
import { useMostUsedExercises, useSessionCountByWeek } from '../../lib/hooks/useProgress';
import { ProgressChart } from '../../components/ProgressChart';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { colors, spacing, borderRadius, fonts, fontSizes } from '../../lib/theme/tokens';
import { formatDuration, formatVolume } from '../../lib/utils/format';
import type { WeightUnit } from '../../lib/utils/weight-unit';

// ─── Types ──────────────────────────────────────────────

type Period = '4w' | '12w' | 'all';

// ─── Stat Card Component ────────────────────────────────

function StatCard({ 
  label, 
  value, 
  delta, 
  icon 
}: { 
  label: string; 
  value: string; 
  delta?: { value: number; isPositive: boolean } | null;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={{
      backgroundColor: colors.bg.card,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.border.primary,
      flex: 1,
      minWidth: 140,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <Ionicons name={icon} size={16} color={colors.accent.primary} />
        <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.body, color: colors.text.secondary }}>
          {label}
        </Text>
      </View>
      <Text style={{ fontSize: fontSizes.xl, fontFamily: fonts.display, color: colors.text.primary }}>
        {value}
      </Text>
      {delta && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs }}>
          <Ionicons 
            name={delta.isPositive ? 'trending-up' : 'trending-down'} 
            size={12} 
            color={delta.isPositive ? colors.success : colors.error} 
          />
          <Text style={{ 
            fontSize: fontSizes.xs, 
            fontFamily: fonts.bodyMedium, 
            color: delta.isPositive ? colors.success : colors.error 
          }}>
            {delta.isPositive ? '+' : ''}{delta.value}%
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────

export default function StatisticsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>('12w');

  const { data: stats, isLoading: statsLoading } = useGlobalStats();
  const { data: exercises, isLoading: exercisesLoading } = useMostUsedExercises();
  const { data: sessionCount, isLoading: sessionLoading } = useSessionCountByWeek();

  // Filter data by period
  const filteredSessionCount = useMemo(() => {
    if (!sessionCount) return [];
    const now = new Date();
    const cutoff = new Date();
    
    switch (period) {
      case '4w':
        cutoff.setDate(now.getDate() - 28);
        break;
      case '12w':
        cutoff.setDate(now.getDate() - 84);
        break;
      case 'all':
        return sessionCount;
    }
    
    return sessionCount.filter((point) => {
      const [year, week] = point.date.split('-').map(Number);
      const weekStart = new Date(year, 0, 1 + (week - 1) * 7);
      return weekStart >= cutoff;
    });
  }, [sessionCount, period]);

  // Group exercises by muscle group (simplified - using exercise name patterns)
  const muscleGroupFrequency = useMemo(() => {
    if (!exercises) return [];
    
    const groups: Record<string, number> = {};
    
    exercises.forEach((ex) => {
      // Simple grouping based on common exercise name patterns
      const name = ex.name.toLowerCase();
      let group = 'Otros';
      
      if (name.includes('press') || name.includes('chest') || name.includes('pecho')) group = 'Pecho';
      else if (name.includes('squat') || name.includes('sentadilla') || name.includes('leg')) group = 'Piernas';
      else if (name.includes('curl') || name.includes('bicep')) group = 'Bíceps';
      else if (name.includes('row') || name.includes('back') || name.includes('espalda')) group = 'Espalda';
      else if (name.includes('shoulder') || name.includes('press militar')) group = 'Hombros';
      else if (name.includes('tricep') || name.includes('extension')) group = 'Tríceps';
      else if (name.includes('lunge') || name.includes('zancada')) group = 'Piernas';
      
      groups[group] = (groups[group] || 0) + ex.sessionCount;
    });
    
    return Object.entries(groups)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [exercises]);

  const isLoading = statsLoading || exercisesLoading || sessionLoading;

  if (isLoading) {
    return <LoadingSpinner message={t('common.loading')} />;
  }

  if (!stats) {
    return (
      <EmptyState 
        icon="bar-chart"
        title={t('progress.statistics.noData')}
        message={t('progress.statistics.startTraining')}
      />
    );
  }

  // Calculate total sessions for the period
  const totalSessionsPeriod = filteredSessionCount.reduce((sum, p) => sum + p.value, 0);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.xxl,
        paddingBottom: spacing.md,
      }}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </Pressable>
        <Ionicons name="bar-chart" size={24} color={colors.accent.primary} />
        <Text style={{ fontSize: fontSizes.xl, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
          {t('progress.statistics.title')}
        </Text>
      </View>

      {/* Period Selector */}
      <View style={{
        flexDirection: 'row',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.lg,
      }}>
        {(['4w', '12w', 'all'] as Period[]).map((p) => (
          <Pressable
            key={p}
            onPress={() => setPeriod(p)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: borderRadius.full,
              backgroundColor: period === p ? colors.accent.primary : colors.bg.elevated,
              borderWidth: 1,
              borderColor: period === p ? colors.accent.primary : colors.border.primary,
            }}
          >
            <Text style={{
              fontSize: fontSizes.sm,
              fontFamily: fonts.bodyMedium,
              color: period === p ? colors.text.primary : colors.text.secondary,
            }}>
              {p === '4w' ? '4 sem' : p === '12w' ? '12 sem' : 'Todo'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Global Stats */}
      <View style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.lg,
      }}>
        <StatCard
          label={t('progress.statistics.totalWorkouts')}
          value={stats.totalWorkouts.toString()}
          icon="fitness"
        />
        <StatCard
          label={t('progress.statistics.totalVolume')}
          value={formatVolume(stats.totalVolume)}
          icon="barbell"
        />
        <StatCard
          label={t('progress.statistics.totalTime')}
          value={formatDuration(stats.totalTime)}
          icon="time"
        />
        <StatCard
          label={t('progress.statistics.currentStreak')}
          value={`${stats.currentStreak} días`}
          icon="flame"
        />
      </View>

      {/* Most Frequent Exercise */}
      {stats.mostFrequentExercise && (
        <View style={{
          backgroundColor: colors.bg.card,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.lg,
          borderWidth: 1,
          borderColor: colors.border.primary,
        }}>
          <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.body, color: colors.text.secondary, marginBottom: spacing.xs }}>
            {t('progress.statistics.mostFrequent')}
          </Text>
          <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
            {stats.mostFrequentExercise}
          </Text>
        </View>
      )}

      {/* Session Frequency Chart */}
      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
        <ProgressChart
          data={filteredSessionCount}
          title={t('progress.statistics.sessionFrequency')}
          unit={t('progress.statistics.sessions')}
        />
      </View>

      {/* Exercise Ranking */}
      {exercises && exercises.length > 0 && (
        <View style={{
          backgroundColor: colors.bg.card,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.lg,
          borderWidth: 1,
          borderColor: colors.border.primary,
        }}>
          <Text style={{ 
            fontSize: fontSizes.md, 
            fontFamily: fonts.bodySemiBold, 
            color: colors.text.primary, 
            marginBottom: spacing.md 
          }}>
            {t('progress.statistics.topExercises')}
          </Text>
          
          {exercises.slice(0, 10).map((ex, index) => {
            const maxSessions = exercises[0]?.sessionCount || 1;
            const barWidth = (ex.sessionCount / maxSessions) * 100;
            
            return (
              <View 
                key={ex.exerciseId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  marginBottom: spacing.sm,
                }}
              >
                <Text style={{ 
                  fontSize: fontSizes.sm, 
                  fontFamily: fonts.bodyMedium, 
                  color: colors.text.muted,
                  width: 20,
                  textAlign: 'right',
                }}>
                  {index + 1}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.body, color: colors.text.primary }}>
                    {ex.name}
                  </Text>
                  <View style={{
                    height: 4,
                    backgroundColor: colors.bg.elevated,
                    borderRadius: 2,
                    marginTop: 4,
                    overflow: 'hidden',
                  }}>
                    <View style={{
                      height: '100%',
                      width: `${barWidth}%`,
                      backgroundColor: colors.accent.primary,
                      borderRadius: 2,
                    }} />
                  </View>
                </View>
                <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.secondary }}>
                  {ex.sessionCount} {t('progress.statistics.sessions')}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Muscle Group Frequency */}
      {muscleGroupFrequency.length > 0 && (
        <View style={{
          backgroundColor: colors.bg.card,
          borderRadius: borderRadius.md,
          padding: spacing.md,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.xxl,
          borderWidth: 1,
          borderColor: colors.border.primary,
        }}>
          <Text style={{ 
            fontSize: fontSizes.md, 
            fontFamily: fonts.bodySemiBold, 
            color: colors.text.primary, 
            marginBottom: spacing.md 
          }}>
            {t('progress.statistics.muscleGroups')}
          </Text>
          
          {muscleGroupFrequency.map((group) => {
            const maxCount = muscleGroupFrequency[0]?.count || 1;
            const barWidth = (group.count / maxCount) * 100;
            
            return (
              <View 
                key={group.name}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  marginBottom: spacing.sm,
                }}
              >
                <Text style={{ 
                  fontSize: fontSizes.sm, 
                  fontFamily: fonts.body, 
                  color: colors.text.primary,
                  width: 80,
                }}>
                  {group.name}
                </Text>
                <View style={{ flex: 1 }}>
                  <View style={{
                    height: 4,
                    backgroundColor: colors.bg.elevated,
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}>
                    <View style={{
                      height: '100%',
                      width: `${barWidth}%`,
                      backgroundColor: colors.accent.muted,
                      borderRadius: 2,
                    }} />
                  </View>
                </View>
                <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.secondary }}>
                  {group.count}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
