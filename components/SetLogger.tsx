import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import type { Set } from '../lib/types';

interface SetLoggerProps {
  set: Set;
  onUpdate: (updates: { reps?: number; weight?: number; completed?: boolean }) => void;
}

export function SetLogger({ set, onUpdate }: SetLoggerProps) {
  const [reps, setReps] = useState(set.reps?.toString() ?? '');
  const [weight, setWeight] = useState(set.weight?.toString() ?? '');

  const handleRepsChange = (text: string) => {
    setReps(text);
    const value = parseInt(text, 10);
    if (isNaN(value) || value < 0) {
      onUpdate({ reps: undefined });
    } else {
      onUpdate({ reps: value });
    }
  };

  const handleWeightChange = (text: string) => {
    setWeight(text);
    const value = parseFloat(text);
    if (isNaN(value) || value < 0) {
      onUpdate({ weight: undefined });
    } else {
      onUpdate({ weight: value });
    }
  };

  return (
    <View className="flex-row items-center gap-3 py-2">
      <Text className="text-sm font-medium text-gray-600 w-8 text-center">
        #{set.setNumber}
      </Text>

      <View className="flex-1">
        <TextInput
          className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center text-gray-900"
          keyboardType="numeric"
          placeholder="Reps"
          placeholderTextColor="#9CA3AF"
          value={reps}
          onChangeText={handleRepsChange}
        />
      </View>

      <View className="flex-1">
        <TextInput
          className="bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center text-gray-900"
          keyboardType="decimal-pad"
          placeholder="kg"
          placeholderTextColor="#9CA3AF"
          value={weight}
          onChangeText={handleWeightChange}
        />
      </View>

      <TouchableOpacity
        onPress={() => onUpdate({ completed: !set.completed })}
        className={`w-9 h-9 rounded-full items-center justify-center ${
          set.completed ? 'bg-green-500' : 'bg-gray-200'
        }`}
      >
        <Text className={`text-sm font-bold ${set.completed ? 'text-white' : 'text-gray-500'}`}>
          {set.completed ? '✓' : ''}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
