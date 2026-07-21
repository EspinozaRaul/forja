import { View, Text } from 'react-native';
import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
}

export function EmptyState({ icon, title, message }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-12 px-6">
      {icon && <View className="mb-4">{icon}</View>}
      <Text className="text-lg font-semibold text-gray-600 mb-1">{title}</Text>
      {message && (
        <Text className="text-sm text-gray-400 text-center">{message}</Text>
      )}
    </View>
  );
}
