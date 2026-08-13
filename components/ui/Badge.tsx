import { View, Text } from 'react-native';
import { colors } from '../../lib/theme/tokens';

interface BadgeProps {
  label: string;
  color?: string;
  className?: string;
}

export function Badge({ label, color = colors.accent.primary, className = '' }: BadgeProps) {
  return (
    <View
      className={`self-start rounded-full px-3 py-1 ${className}`}
      style={{ backgroundColor: `${color}25` }}
    >
      <Text className="text-xs font-bold" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}
