import { Text, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';
import { useExercises } from '../../lib/hooks/useExercises';
import { useTotalVolumeByWeek, useSessionCountByWeek } from '../../lib/hooks/useProgress';
import { ProgressChart } from '../../components/ProgressChart';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';

type DateRange = '4weeks' | '12weeks' | 'all';

export default function ProgressScreen() {
  const { data: exercises, isLoading: exercisesLoading } = useExercises();
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('12weeks');

  const { data: volumeData, isLoading: volumeLoading } = useTotalVolumeByWeek(
    selectedExerciseId ?? 0
  );
  const { data: sessionData, isLoading: sessionLoading } = useSessionCountByWeek(
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

  if (isLoading) {
    return <LoadingSpinner message="Loading progress..." />;
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Exercise Selection */}
      <View className="bg-white p-4 border-b border-gray-200">
        <Text className="text-sm font-medium text-gray-700 mb-2">Select Exercise</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            onPress={() => setSelectedExerciseId(null)}
            className={`px-3 py-2 rounded-lg mr-2 ${
              selectedExerciseId === null ? 'bg-blue-500' : 'bg-gray-100'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                selectedExerciseId === null ? 'text-white' : 'text-gray-700'
              }`}
            >
              All Exercises
            </Text>
          </TouchableOpacity>
          {exercises?.map((exercise) => (
            <TouchableOpacity
              key={exercise.id}
              onPress={() => setSelectedExerciseId(exercise.id)}
              className={`px-3 py-2 rounded-lg mr-2 ${
                selectedExerciseId === exercise.id ? 'bg-blue-500' : 'bg-gray-100'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  selectedExerciseId === exercise.id ? 'text-white' : 'text-gray-700'
                }`}
              >
                {exercise.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Date Range Filter */}
      <View className="bg-white p-4 border-b border-gray-200">
        <Text className="text-sm font-medium text-gray-700 mb-2">Date Range</Text>
        <View className="flex-row">
          {(['4weeks', '12weeks', 'all'] as DateRange[]).map((range) => (
            <TouchableOpacity
              key={range}
              onPress={() => setDateRange(range)}
              className={`px-4 py-2 rounded-lg mr-2 ${
                dateRange === range ? 'bg-blue-500' : 'bg-gray-100'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  dateRange === range ? 'text-white' : 'text-gray-700'
                }`}
              >
                {range === '4weeks' ? '4 Weeks' : range === '12weeks' ? '12 Weeks' : 'All Time'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Charts */}
      <View className="p-4">
        {selectedExerciseId === null ? (
          <EmptyState
            title="Select an exercise"
            message="Choose an exercise above to view its progress."
          />
        ) : (
          <>
            <View className="mb-4">
              <ProgressChart
                data={filteredVolumeData}
                title="Weekly Volume (kg)"
                unit="kg"
              />
            </View>
            <View className="mb-4">
              <ProgressChart
                data={filteredSessionData}
                title="Sessions per Week"
              />
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
