import { View, Text, TextInput, TouchableOpacity, FlatList, Modal } from 'react-native';
import { useState, useMemo } from 'react';
import type { Exercise } from '../lib/types';

interface ExercisePickerProps {
  visible: boolean;
  exercises: Exercise[];
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
}

export function ExercisePicker({ visible, exercises, onSelect, onClose }: ExercisePickerProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return exercises;
    const query = search.toLowerCase();
    return exercises.filter((e) => e.name.toLowerCase().includes(query));
  }, [exercises, search]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-white border-b border-gray-200 px-4 py-3 flex-row items-center justify-between">
          <TouchableOpacity onPress={onClose}>
            <Text className="text-blue-500 font-medium">Cancel</Text>
          </TouchableOpacity>
          <Text className="text-base font-semibold text-gray-900">Select Exercise</Text>
          <View className="w-16" />
        </View>

        {/* Search */}
        <View className="px-4 py-3">
          <TextInput
            className="bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900"
            placeholder="Search exercises..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        </View>

        {/* List */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          ListEmptyComponent={
            <View className="py-12 items-center">
              <Text className="text-gray-400 text-sm">No exercises found</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => onSelect(item)}
              className="bg-white rounded-lg px-4 py-3 mb-2 border border-gray-100"
            >
              <Text className="text-base font-medium text-gray-900">{item.name}</Text>
              {item.description && (
                <Text className="text-sm text-gray-500 mt-0.5">{item.description}</Text>
              )}
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}
