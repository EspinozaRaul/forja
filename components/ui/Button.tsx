import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';
import { type ReactNode } from 'react';
import { colors, spacing, borderRadius, fonts } from '../../lib/theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'accent';

interface ButtonProps {
  title?: string;
  variant?: ButtonVariant;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}

const variantStyles: Record<ButtonVariant, { container: any; text: any }> = {
  primary: {
    container: { backgroundColor: colors.accent.primary },
    text: { color: colors.text.primary },
  },
  secondary: {
    container: { backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.primary },
    text: { color: colors.text.primary },
  },
  danger: {
    container: { backgroundColor: colors.error },
    text: { color: colors.text.primary },
  },
  accent: {
    container: { backgroundColor: colors.accent.muted },
    text: { color: colors.accent.primary },
  },
};

export function Button({
  title,
  variant = 'primary',
  onPress,
  disabled = false,
  loading = false,
  children,
  className = '',
  compact = false,
}: ButtonProps) {
  const styles = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: compact ? borderRadius.sm : borderRadius.md, paddingHorizontal: compact ? spacing.md : spacing.lg, paddingVertical: compact ? spacing.sm : spacing.md },
        styles.container,
        isDisabled && { opacity: 0.4 },
      ]}
      className={`flex-row items-center justify-center rounded-xl px-6 py-4 ${
        isDisabled ? 'opacity-40' : ''
      } ${className}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'secondary' ? colors.text.primary : colors.text.primary} />
      ) : children ? (
        children
      ) : (
        <Text style={[{ fontSize: compact ? 14 : 16, fontFamily: fonts.bodySemiBold, flexShrink: 0 }, styles.text]} className={`text-base font-bold`}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
