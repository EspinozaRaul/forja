import { View, Text } from 'react-native';

interface BadgeProps {
  label: string;
  color?: string;
  className?: string;
}

export function Badge({ label, color = '#3B82F6', className = '' }: BadgeProps) {
  return (
    <View
      className={`self-start rounded-full px-2 py-0.5 ${className}`}
      style={{ backgroundColor: `${color}20` }}
    >
      <Text className="text-xs font-medium" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}
