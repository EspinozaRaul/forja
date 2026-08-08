import { View, ActivityIndicator, Text } from 'react-native';

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48, backgroundColor: '#0A0A0A' }} className="flex-1 items-center justify-center py-12 bg-dark-bg">
      <ActivityIndicator size="large" color="#00F5A0" />
      {message && (
        <Text style={{ fontSize: 14, color: '#A0A0A0', marginTop: 16 }} className="text-sm text-dark-text-secondary mt-4">{message}</Text>
      )}
    </View>
  );
}
