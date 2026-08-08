import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';
import { type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'accent';

interface ButtonProps {
  title?: string;
  variant?: ButtonVariant;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  children?: ReactNode;
  className?: string;
}

const variantStyles: Record<ButtonVariant, { container: any; text: any }> = {
  primary: {
    container: { backgroundColor: '#00F5A0' },
    text: { color: '#0A0A0A' },
  },
  secondary: {
    container: { backgroundColor: '#222222', borderWidth: 1, borderColor: '#2A2A2A' },
    text: { color: '#FFFFFF' },
  },
  danger: {
    container: { backgroundColor: '#FF3B30' },
    text: { color: '#FFFFFF' },
  },
  accent: {
    container: { backgroundColor: 'rgba(0, 245, 160, 0.2)' },
    text: { color: '#00F5A0' },
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
}: ButtonProps) {
  const styles = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 16 },
        styles.container,
        isDisabled && { opacity: 0.4 },
      ]}
      className={`flex-row items-center justify-center rounded-xl px-6 py-4 ${
        isDisabled ? 'opacity-40' : ''
      } ${className}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'secondary' ? '#FFFFFF' : '#0A0A0A'} />
      ) : children ? (
        children
      ) : (
        <Text style={[{ fontSize: 16, fontWeight: 'bold' }, styles.text]} className={`text-base font-bold`}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
