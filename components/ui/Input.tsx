import { TextInput, View, Text, type TextInputProps } from 'react-native';
import { colors, spacing, borderRadius, fonts, fontSizes, borderWidths } from '../../lib/theme/tokens';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  const inputStyle = {
    backgroundColor: colors.bg.elevated,
    borderWidth: borderWidths.thin,
    borderColor: error ? colors.error : colors.border.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSizes.lg, fontFamily: fonts.body,
    color: colors.text.primary,
    tintColor: colors.accent.primary,
  };

  return (
    <View style={{ marginBottom: spacing.md }} className={className}>
      {label && (
        <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodyMedium, color: colors.text.secondary, marginBottom: spacing.sm }}>{label}</Text>
      )}
      <TextInput
        style={inputStyle as any}
        placeholderTextColor={colors.text.muted}
        {...props}
      />
      {error && <Text style={{ color: colors.error, fontSize: fontSizes.sm, marginTop: spacing.xs }}>{error}</Text>}
    </View>
  );
}
