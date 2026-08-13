import { View, Text, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius, fonts } from '../lib/theme/tokens';
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
      <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md + spacing.xs }}>
        {title && (
          <Text style={{ fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: 8 }}>{title}</Text>
        )}
        <View style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.text.muted, fontSize: 14, fontFamily: fonts.body }}>No data yet</Text>
        </View>
      </View>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value));

  return (
    <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md + spacing.xs }}>
      {title && (
        <Text style={{ fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: 16 }}>{title}</Text>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 160, gap: 4 }}>
        {data.map((point, index) => {
          const heightPercent = maxValue > 0 ? (point.value / maxValue) * 100 : 0;
          const isSelected = selectedWeek === point.date;
          const barColor = isSelected ? colors.warning : colors.accent.primary;

          return (
            <TouchableOpacity
              key={index}
              style={{ flex: 1, alignItems: 'center' }}
              onPress={() => onBarPress?.(point.date)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 10, fontFamily: fonts.body, color: isSelected ? colors.warning : colors.text.secondary, marginBottom: 4, fontWeight: isSelected ? '700' : '400' }}>
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
              <Text style={{ fontSize: 10, fontFamily: fonts.body, color: isSelected ? colors.warning : colors.text.muted, marginTop: 4, fontWeight: isSelected ? '700' : '400' }} numberOfLines={1}>
                {point.date.slice(-2)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
