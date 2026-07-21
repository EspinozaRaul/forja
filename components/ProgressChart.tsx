import { View, Text } from 'react-native';
import type { ProgressDataPoint } from '../lib/types';

interface ProgressChartProps {
  data: ProgressDataPoint[];
  title?: string;
  unit?: string;
}

function formatValue(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toString();
}

export function ProgressChart({ data, title, unit = '' }: ProgressChartProps) {
  if (data.length === 0) {
    return (
      <View className="bg-white rounded-lg p-4 shadow-sm">
        {title && (
          <Text className="text-sm font-semibold text-gray-700 mb-2">{title}</Text>
        )}
        <View className="h-40 items-center justify-center">
          <Text className="text-gray-400 text-sm">No data yet</Text>
        </View>
      </View>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value));
  const barWidth = `${Math.min(100, 80 / data.length)}%`;

  return (
    <View className="bg-white rounded-lg p-4 shadow-sm">
      {title && (
        <Text className="text-sm font-semibold text-gray-700 mb-3">{title}</Text>
      )}

      <View className="flex-row items-end justify-between h-40 gap-1">
        {data.map((point, index) => {
          const heightPercent = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
          return (
            <View key={index} className="flex-1 items-center">
              <Text className="text-[10px] text-gray-500 mb-1">
                {formatValue(point.value)}{unit}
              </Text>
              <View
                className="bg-blue-500 rounded-t"
                style={{
                  width: '80%',
                  height: `${Math.max(heightPercent, 4)}%`,
                }}
              />
              <Text className="text-[10px] text-gray-400 mt-1" numberOfLines={1}>
                {point.date.slice(-2)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
