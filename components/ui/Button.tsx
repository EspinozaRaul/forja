import { TouchableOpacity, Text, ActivityIndicator, type ViewStyle, type TextStyle } from 'react-native';
import { type ReactNode } from 'react';
import { colors, spacing, borderRadius, fonts, fontSizes, borderWidths } from '../../lib/theme/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'accent';

interface ButtonProps {
  title?: string;
  variant?: ButtonVariant;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  children?: ReactNode;
  compact?: boolean;
  style?: ViewStyle;
}

const variantStyles: Record<ButtonVariant, { container: ViewStyle; text: TextStyle }> = {
  primary: {
    container: { backgroundColor: colors.accent.primary },
    text: { color: colors.text.primary },
  },
  secondary: {
    container: { backgroundColor: colors.bg.elevated, borderWidth: borderWidths.thin, borderColor: colors.border.primary },
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
  compact = false,
  style,
}: ButtonProps) {
  const styles = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: compact ? borderRadius.sm : borderRadius.md,
          paddingHorizontal: compact ? spacing.md : spacing.lg,
          paddingVertical: compact ? spacing.sm : spacing.md,
        },
        styles.container,
        isDisabled && { opacity: 0.4 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.text.primary} />
      ) : children ? (
        children
      ) : (
        <Text
          style={{
            fontSize: compact ? fontSizes.sm : fontSizes.md,
            fontFamily: fonts.bodySemiBold,
            flexShrink: 0,
            ...styles.text,
          }}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}
