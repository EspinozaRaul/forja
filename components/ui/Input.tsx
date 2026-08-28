import { TextInput, View, Text, type TextInputProps } from 'react-native';
import { colors, spacing, borderRadius, fonts } from '../../lib/theme/tokens';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  const inputStyle = {
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: error ? colors.error : colors.border.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.text.primary,
    tintColor: colors.accent.primary,
  };

  return (
    <View style={{ marginBottom: spacing.md }} className={className}>
      {label && (
        <Text style={{ fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.text.secondary, marginBottom: spacing.sm }}>{label}</Text>
      )}
      <TextInput
        style={inputStyle as any}
        placeholderTextColor={colors.text.muted}
        {...props}
      />
      {error && <Text style={{ color: colors.error, fontSize: 14, marginTop: 4 }}>{error}</Text>}
    </View>
  );
}
