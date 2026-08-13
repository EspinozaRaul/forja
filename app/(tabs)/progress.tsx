import { Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useExercises } from '../../lib/hooks/useExercises';
import { useTotalVolumeByWeek, useSessionCountByWeek, useWeeklySessions } from '../../lib/hooks/useProgress';
import { ProgressChart } from '../../components/ProgressChart';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDuration, formatRelativeDate } from '../../lib/utils/format';
import { colors, spacing, borderRadius } from '../../lib/theme/tokens';
import { EXERCISE_NAMES_ES } from '../../lib/db/exercise-names-es';

type DateRange = '4weeks' | '12weeks' | 'all';

function formatVolume(kg: number): string {
  if (kg >= 1000) {
    return `${(kg / 1000).toFixed(1)}k`;
  }
  return kg.toFixed(1);
}

export default function ProgressScreen() {
  const router = useRouter();
  const { data: exercises, isLoading: exercisesLoading } = useExercises();
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('12weeks');
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  const { data: volumeData, isLoading: volumeLoading } = useTotalVolumeByWeek(
    selectedExerciseId ?? 0
  );
  const { data: sessionData, isLoading: sessionLoading } = useSessionCountByWeek(
    selectedExerciseId ?? undefined
  );
  const { data: weeklySessions, isLoading: weeklyLoading } = useWeeklySessions(
    selectedWeek,
    selectedExerciseId ?? undefined
  );

  const isLoading = exercisesLoading || volumeLoading || sessionLoading;

  // Filter data by date range
  const filterByDateRange = (data: { date: string; value: number }[]) => {
    if (dateRange === 'all') return data;
    
    const weeksToShow = dateRange === '4weeks' ? 4 : 12;
    const now = new Date();
    const cutoffWeek = new Date(now.getTime() - weeksToShow * 7 * 24 * 60 * 60 * 1000);
    const cutoffStr = `${cutoffWeek.getFullYear()}-${String(cutoffWeek.getMonth() + 1).padStart(2, '0')}`;
    
    return data.filter((point) => point.date >= cutoffStr);
  };

  const filteredVolumeData = filterByDateRange(volumeData ?? []);
  const filteredSessionData = filterByDateRange(sessionData ?? []);

  const handleBarPress = (week: string) => {
    setSelectedWeek(selectedWeek === week ? null : week);
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading progress..." />;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {/* Exercise Selection */}
      <View style={{ backgroundColor: colors.bg.card, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border.primary }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.sm }}>Select Exercise</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            onPress={() => { setSelectedExerciseId(null); setSelectedWeek(null); }}
            style={{
              backgroundColor: selectedExerciseId === null ? colors.accent.primary : colors.bg.elevated,
              borderWidth: selectedExerciseId === null ? 0 : 1,
              borderColor: colors.border.primary,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm + spacing.xs,
              borderRadius: borderRadius.md,
              marginRight: 8,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: selectedExerciseId === null ? colors.bg.primary : colors.text.secondary }}>
              All Exercises
            </Text>
          </TouchableOpacity>
          {exercises?.map((exercise) => (
            <View key={exercise.id} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
              <TouchableOpacity
                onPress={() => { setSelectedExerciseId(exercise.id); setSelectedWeek(null); }}
                style={{
                  backgroundColor: selectedExerciseId === exercise.id ? colors.accent.primary : colors.bg.elevated,
                  borderWidth: selectedExerciseId === exercise.id ? 0 : 1,
                  borderColor: colors.border.primary,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm + spacing.xs,
                  borderRadius: borderRadius.md,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '600', color: selectedExerciseId === exercise.id ? colors.bg.primary : colors.text.secondary }}>
                  {EXERCISE_NAMES_ES[exercise.name] || exercise.name}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push(`/exercise/${exercise.id}`)}
                style={{ marginLeft: 4, padding: 6 }}
              >
                <Text style={{ fontSize: 14, color: colors.accent.primary }}>ℹ️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Date Range Filter */}
      <View style={{ backgroundColor: colors.bg.card, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border.primary }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.sm }}>Date Range</Text>
        <View style={{ flexDirection: 'row' }}>
          {(['4weeks', '12weeks', 'all'] as DateRange[]).map((range) => (
            <TouchableOpacity
              key={range}
              onPress={() => { setDateRange(range); setSelectedWeek(null); }}
              style={{
                backgroundColor: dateRange === range ? colors.accent.primary : colors.bg.elevated,
                borderWidth: dateRange === range ? 0 : 1,
                borderColor: colors.border.primary,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm + spacing.xs,
                borderRadius: borderRadius.md,
                marginRight: 8,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: dateRange === range ? colors.bg.primary : colors.text.secondary }}>
                {range === '4weeks' ? '4 Weeks' : range === '12weeks' ? '12 Weeks' : 'All Time'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Charts */}
      <View style={{ padding: spacing.md }}>
        {selectedExerciseId === null ? (
          <EmptyState
            title="Select an exercise"
            message="Choose an exercise above to view its progress."
          />
        ) : (
          <>
            <View style={{ marginBottom: spacing.md }}>
              <ProgressChart
                data={filteredVolumeData}
                title="Weekly Volume (kg)"
                unit="kg"
                selectedWeek={selectedWeek}
                onBarPress={handleBarPress}
              />
            </View>
            <View style={{ marginBottom: spacing.md }}>
              <ProgressChart
                data={filteredSessionData}
                title="Sessions per Week"
                selectedWeek={selectedWeek}
                onBarPress={handleBarPress}
              />
            </View>

            {/* Week Detail Panel */}
            {selectedWeek && (
              <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.md, padding: spacing.lg, marginTop: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
                  <Text style={{ fontSize: 16, fontWeight: 'bold', color: colors.text.primary }}>
                    Week {selectedWeek}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedWeek(null)}>
                    <Text style={{ fontSize: 14, color: colors.accent.primary }}>Clear</Text>
                  </TouchableOpacity>
                </View>

                {weeklyLoading ? (
                  <LoadingSpinner message="Loading week data..." />
                ) : !weeklySessions || weeklySessions.length === 0 ? (
                  <Text style={{ fontSize: 14, color: colors.text.muted, textAlign: 'center', paddingVertical: spacing.md }}>
                    No sessions this week
                  </Text>
                ) : (
                  weeklySessions.map((session) => (
                    <TouchableOpacity
                      key={session.sessionId}
                      onPress={() => router.push(`/session/history/${session.sessionId}`)}
                      style={{
                        backgroundColor: colors.bg.elevated,
                        borderRadius: borderRadius.sm,
                        padding: spacing.md,
                        marginBottom: spacing.sm,
                      }}
                    >
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
                      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                        <View>
                          <Text style={{ fontSize: 12, color: colors.text.muted }}>Volume</Text>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary }}>
                            {formatVolume(session.totalVolume)} kg
                          </Text>
                        </View>
                        <View>
                          <Text style={{ fontSize: 12, color: colors.text.muted }}>Exercises</Text>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary }}>
                            {session.exerciseCount}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}
