import { View, TouchableOpacity, type ViewProps, type ViewStyle } from 'react-native';
import { type ReactNode } from 'react';
import { colors, spacing, borderRadius, borderWidths } from '../../lib/theme/tokens';

interface CardProps extends ViewProps {
  onPress?: () => void;
  children: ReactNode;
  style?: ViewStyle;
}

export function Card({ onPress, children, style, ...props }: CardProps) {
  const content = (
    <View
      style={[
        {
          backgroundColor: colors.bg.card,
          borderRadius: borderRadius.lg,
          borderWidth: borderWidths.thin,
          borderColor: colors.border.primary,
          padding: spacing.md,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}
