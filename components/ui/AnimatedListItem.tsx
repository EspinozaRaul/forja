import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

interface AnimatedListItemProps {
  children: React.ReactNode;
  index?: number;
  delay?: number;
  duration?: number;
  className?: string;
}

/**
 * Fade-in list item wrapper (Reanimated).
 *
 * Uses a native entering animation instead of manually driving a shared value
 * with a setTimeout. Mounting is guaranteed to play the animation, so an item
 * can never get stuck invisible when a screen remounts (e.g. navigating back).
 */
export function AnimatedListItem({
  children,
  index = 0,
  delay = 50,
  duration = 300,
  className = '',
}: AnimatedListItemProps) {
  const entering = FadeInDown.delay(index * delay).duration(duration);

  return (
    <Animated.View entering={entering} className={className}>
      {children}
    </Animated.View>
  );
}

// Pre-defined animation variants
export const fadeIn = FadeIn;
export const fadeInDown = FadeInDown;