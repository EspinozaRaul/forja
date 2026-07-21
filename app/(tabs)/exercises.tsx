import { Text, View, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useState, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useExercises } from '../../lib/hooks/useExercises';
import { useCategories } from '../../lib/hooks/useCategories';
import { ExerciseCard } from '../../components/ExerciseCard';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { AnimatedListItem } from '../../components/ui/AnimatedListItem';
import type { ExerciseWithCategory } from '../../lib/types';

export default function ExercisesScreen() {
  const router = useRouter();
  const { data: exercises, isLoading: exercisesLoading } = useExercises();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const isLoading = exercisesLoading || categoriesLoading;

  // Merge exercises with category info
  const exercisesWithCategories: ExerciseWithCategory[] = useMemo(() => {
    if (!exercises) return [];
    return exercises.map((exercise) => {
      const category = categories?.find((c) => c.id === exercise.categoryId);
      return { ...exercise, category };
    });
  }, [exercises, categories]);

  // Filter exercises
  const filteredExercises = useMemo(() => {
    let result = exercisesWithCategories;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          e.description?.toLowerCase().includes(query)
      );
    }
    if (selectedCategory) {
      result = result.filter((e) => e.categoryId === selectedCategory);
    }
    return result;
  }, [exercisesWithCategories, searchQuery, selectedCategory]);

  // Group by category
  const groupedExercises = useMemo(() => {
    const groups: Record<string, ExerciseWithCategory[]> = {};
    filteredExercises.forEach((exercise) => {
      const categoryName = exercise.category?.name ?? 'Uncategorized';
      if (!groups[categoryName]) {
        groups[categoryName] = [];
      }
      groups[categoryName].push(exercise);
    });
    return groups;
  }, [filteredExercises]);

  if (isLoading) {
    return <LoadingSpinner message="Loading exercises..." />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Search and Filter */}
      <View className="bg-white p-4">
        <TextInput
          className="bg-gray-100 border border-gray-200 rounded-lg px-4 py-3 text-base text-gray-900 mb-3"
          placeholder="Search exercises..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
          <TouchableOpacity
            onPress={() => setSelectedCategory(null)}
            className={`px-3 py-1 rounded-full mr-2 ${
              selectedCategory === null ? 'bg-blue-500' : 'bg-gray-200'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                selectedCategory === null ? 'text-white' : 'text-gray-700'
              }`}
            >
              All
            </Text>
          </TouchableOpacity>
          {categories?.map((category) => (
            <TouchableOpacity
              key={category.id}
              onPress={() => setSelectedCategory(category.id)}
              className={`px-3 py-1 rounded-full mr-2 ${
                selectedCategory === category.id ? 'bg-blue-500' : 'bg-gray-200'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  selectedCategory === category.id ? 'text-white' : 'text-gray-700'
                }`}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Exercise List */}
      <ScrollView className="flex-1 p-4">
        {Object.keys(groupedExercises).length === 0 ? (
          <EmptyState
            title="No exercises found"
            message="Create your first exercise to get started."
          />
        ) : (
          Object.entries(groupedExercises).map(([categoryName, exercises]) => (
            <View key={categoryName} className="mb-6">
              <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {categoryName}
              </Text>
              {exercises.map((exercise, index) => (
                <AnimatedListItem key={exercise.id} index={index} delay={80}>
                  <TouchableOpacity
                    onPress={() => router.push(`/exercise/${exercise.id}`)}
                    className="mb-2"
                  >
                    <ExerciseCard exercise={exercise} />
                  </TouchableOpacity>
                </AnimatedListItem>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Exercise Button */}
      <View className="p-4 bg-white border-t border-gray-200">
        <Button title="Add New Exercise" onPress={() => router.push('/exercise/create')} />
      </View>
    </View>
  );
}
