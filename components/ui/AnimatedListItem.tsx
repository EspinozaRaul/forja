import { useEffect } from 'react';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  Easing,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { View } from 'react-native';

interface AnimatedListItemProps {
  children: React.ReactNode;
  index?: number;
  delay?: number;
  duration?: number;
  className?: string;
}

export function AnimatedListItem({ 
  children, 
  index = 0, 
  delay = 50,
  duration = 300,
  className = ''
}: AnimatedListItemProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    const timeout = setTimeout(() => {
      opacity.value = withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
      translateY.value = withTiming(0, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
    }, index * delay);

    return () => clearTimeout(timeout);
  }, [index, delay, duration, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animatedStyle} className={className}>
      {children}
    </Animated.View>
  );
}

// Pre-defined animation variants
export const fadeIn = FadeIn;
export const fadeInDown = FadeInDown;
