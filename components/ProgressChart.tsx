import { View, Text, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts } from '../lib/theme/tokens';
import type { ProgressDataPoint } from '../lib/types';

interface ProgressChartProps {
  data: ProgressDataPoint[];
  title?: string;
  unit?: string;
  selectedWeek?: string | null;
  onBarPress?: (week: string) => void;
  embedded?: boolean;
}

function formatValue(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return value.toString();
}

export function ProgressChart({ data, title, unit = '', embedded = false }: ProgressChartProps) {
  const { t } = useTranslation();
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = embedded ? screenWidth - spacing.md * 4 : screenWidth - spacing.lg * 2 - spacing.xs * 2;

  const containerStyle = embedded
    ? { backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border.primary }
    : { backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md + spacing.xs };

  if (data.length === 0) {
    return (
      <View style={containerStyle}>
        {title && (
          <Text style={{ fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: 8 }}>{title}</Text>
        )}
        <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.text.muted, fontSize: 14, fontFamily: fonts.body }}>{t('progress.noDataYet')}</Text>
        </View>
      </View>
    );
  }

  const labels = data.map((d) => {
    const day = d.date.split('-')[2] ?? d.date.slice(-2);
    return day;
  });

  const values = data.map((d) => d.value);

  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const decimalPlaces = maxValue >= 100 ? 0 : maxValue >= 10 ? 1 : 1;

  return (
    <View style={containerStyle}>
      {title && (
        <Text style={{ fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: 12 }}>{title}</Text>
      )}

      <LineChart
        data={{
          labels,
          datasets: [{ data: values }],
        }}
        width={chartWidth}
        height={180}
        yAxisSuffix={unit}
        yAxisLabel=""
        chartConfig={{
          backgroundColor: 'transparent',
          backgroundGradientFrom: colors.bg.elevated,
          backgroundGradientTo: colors.bg.elevated,
          decimalPlaces,
          color: (opacity = 1) => `rgba(74, 111, 165, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(158, 165, 180, ${opacity})`,
          style: {
            borderRadius: borderRadius.md,
          },
          propsForDots: {
            r: '4',
            strokeWidth: '2',
            stroke: colors.accent.primary,
            fill: colors.bg.elevated,
          },
          propsForBackgroundLines: {
            stroke: colors.border.primary,
            strokeDasharray: '4 4',
          },
        }}
        bezier
        style={{
          marginVertical: spacing.sm,
          borderRadius: borderRadius.md,
          marginLeft: -spacing.md,
        }}
        formatYLabel={(value) => formatValue(parseFloat(value))}
        withInnerLines={true}
        withOuterLines={false}
        withVerticalLines={false}
        withHorizontalLines={true}
        segments={4}
      />
    </View>
  );
}
