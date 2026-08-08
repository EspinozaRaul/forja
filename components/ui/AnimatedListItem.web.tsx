// Web mock — renders children without animation
// This file is only used on web (Metro resolves .web.ts over .ts)

import { View } from 'react-native';

interface AnimatedListItemProps {
  children: React.ReactNode;
  index?: number;
  delay?: number;
  duration?: number;
  className?: string;
}

export function AnimatedListItem({ children, className = '' }: AnimatedListItemProps) {
  return <View className={className}>{children}</View>;
}

// Pre-defined animation variants (no-ops for web)
export const fadeIn = undefined;
export const fadeInDown = undefined;
