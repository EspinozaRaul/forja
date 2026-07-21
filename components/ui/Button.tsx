import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';
import { type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps {
  title?: string;
  variant?: ButtonVariant;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  children?: ReactNode;
  className?: string;
}

const variantStyles: Record<ButtonVariant, { container: string; text: string }> = {
  primary: {
    container: 'bg-blue-500 active:bg-blue-600',
    text: 'text-white',
  },
  secondary: {
    container: 'bg-gray-200 active:bg-gray-300',
    text: 'text-gray-800',
  },
  danger: {
    container: 'bg-red-500 active:bg-red-600',
    text: 'text-white',
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
      className={`flex-row items-center justify-center rounded-lg px-4 py-3 ${
        isDisabled ? 'opacity-50' : ''
      } ${styles.container} ${className}`}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'secondary' ? '#374151' : '#FFFFFF'} />
      ) : children ? (
        children
      ) : (
        <Text className={`text-base font-semibold ${styles.text}`}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
