import { View, TouchableOpacity, type ViewProps } from 'react-native';
import { type ReactNode } from 'react';

interface CardProps extends ViewProps {
  onPress?: () => void;
  children: ReactNode;
}

export function Card({ onPress, children, className = '', ...props }: CardProps) {
  const content = (
    <View
      className={`bg-dark-card rounded-2xl p-5 ${className}`}
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
