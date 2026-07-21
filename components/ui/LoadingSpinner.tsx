import { View, ActivityIndicator, Text } from 'react-native';

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <View className="flex-1 items-center justify-center py-12">
      <ActivityIndicator size="large" color="#3B82F6" />
      {message && (
        <Text className="text-sm text-gray-500 mt-3">{message}</Text>
      )}
    </View>
  );
}
