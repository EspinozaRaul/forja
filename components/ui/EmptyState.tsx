import { View, Text } from 'react-native';
import { type ReactNode } from 'react';
import { colors, spacing, fonts } from '../../lib/theme/tokens';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  message?: string;
}

export function EmptyState({ icon, title, message }: EmptyStateProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, backgroundColor: colors.bg.primary }} className="flex-1 items-center justify-center py-12 px-6 bg-dark-bg">
      {icon && <View style={{ marginBottom: spacing.md }} className="mb-4">{icon}</View>}
      <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.secondary, marginBottom: spacing.sm }} className="text-lg font-semibold text-dark-text-secondary mb-2">{title}</Text>
      {message && (
        <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.muted, textAlign: 'center' }} className="text-sm text-dark-text-muted text-center">{message}</Text>
      )}
    </View>
  );
}
