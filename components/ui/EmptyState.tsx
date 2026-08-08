import { View, Text } from 'react-native';
import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
}

export function EmptyState({ icon, title, message }: EmptyStateProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24, backgroundColor: '#0A0A0A' }} className="flex-1 items-center justify-center py-12 px-6 bg-dark-bg">
      {icon && <View style={{ marginBottom: 16 }} className="mb-4">{icon}</View>}
      <Text style={{ fontSize: 18, fontWeight: '600', color: '#A0A0A0', marginBottom: 8 }} className="text-lg font-semibold text-dark-text-secondary mb-2">{title}</Text>
      {message && (
        <Text style={{ fontSize: 14, color: '#666666', textAlign: 'center' }} className="text-sm text-dark-text-muted text-center">{message}</Text>
      )}
    </View>
  );
}
