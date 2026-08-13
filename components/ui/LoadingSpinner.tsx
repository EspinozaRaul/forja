import { View, ActivityIndicator, Text } from 'react-native';
import { colors, spacing, fonts } from '../../lib/theme/tokens';

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message }: LoadingSpinnerProps) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, backgroundColor: colors.bg.primary }} className="flex-1 items-center justify-center py-12 bg-dark-bg">
      <ActivityIndicator size="large" color={colors.accent.primary} />
      {message && (
        <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.secondary, marginTop: spacing.md }} className="text-sm text-dark-text-secondary mt-4">{message}</Text>
      )}
    </View>
  );
}
