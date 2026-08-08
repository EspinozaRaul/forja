import { View, Text, TouchableOpacity } from 'react-native';
import type { ProgressDataPoint } from '../lib/types';

interface ProgressChartProps {
  data: ProgressDataPoint[];
  title?: string;
  unit?: string;
  selectedWeek?: string | null;
  onBarPress?: (week: string) => void;
}

function formatValue(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toString();
}

export function ProgressChart({ data, title, unit = '', selectedWeek, onBarPress }: ProgressChartProps) {
  if (data.length === 0) {
    return (
      <View style={{ backgroundColor: '#1A1A1A', borderRadius: 16, padding: 20 }}>
        {title && (
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 }}>{title}</Text>
        )}
        <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#666666', fontSize: 14 }}>No data yet</Text>
        </View>
      </View>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <View style={{ backgroundColor: '#1A1A1A', borderRadius: 16, padding: 20 }}>
      {title && (
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 16 }}>{title}</Text>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160, gap: 4 }}>
        {data.map((point, index) => {
          const heightPercent = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
          const isSelected = selectedWeek === point.date;
          const barColor = isSelected ? '#FFB800' : '#00F5A0';

          return (
            <TouchableOpacity
              key={index}
              style={{ flex: 1, alignItems: 'center' }}
              onPress={() => onBarPress?.(point.date)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 10, color: isSelected ? '#FFB800' : '#A0A0A0', marginBottom: 4, fontWeight: isSelected ? '700' : '400' }}>
                {formatValue(point.value)}{unit}
              </Text>
              <View
                style={{
                  backgroundColor: barColor,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  width: '80%',
                  height: `${Math.max(heightPercent, 4)}%`,
                  opacity: selectedWeek && !isSelected ? 0.4 : 1,
                }}
              />
              <Text style={{ fontSize: 10, color: isSelected ? '#FFB800' : '#666666', marginTop: 4, fontWeight: isSelected ? '700' : '400' }} numberOfLines={1}>
                {point.date.slice(-2)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
