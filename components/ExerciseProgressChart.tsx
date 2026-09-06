import { View, Text, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { colors, spacing, borderRadius, fonts } from '../lib/theme/tokens';
import { EmptyState } from './ui/EmptyState';
import type { ExerciseProgressionDataPoint } from '../lib/db/queries';

interface ExerciseProgressChartProps {
  data: ExerciseProgressionDataPoint[];
  unit?: string;
}

function formatDate(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${day}/${months[d.getMonth()]}`;
}

export function ExerciseProgressChart({ data, unit = 'kg' }: ExerciseProgressChartProps) {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - spacing.lg * 2 - spacing.md * 2;

  if (data.length === 0) {
    return (
      <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border.primary, padding: spacing.md }}>
        <EmptyState
          icon="trending-up"
          title="Sin datos de progreso"
          message="Completá sesiones para ver tu evolución"
        />
      </View>
    );
  }

  // Sort by date ascending
  const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const labels = sorted.map((d) => formatDate(d.date));
  const weightValues = sorted.map((d) => d.avgWeight ?? 0);
  const repValues = sorted.map((d) => d.avgReps ?? 0);

  const maxWeight = Math.max(...weightValues);
  const maxReps = Math.max(...repValues);

  // Determine decimal places based on data range
  const weightDecimals = maxWeight >= 100 ? 0 : maxWeight >= 10 ? 1 : 1;
  const repDecimals = 0; // Reps are always whole numbers

  return (
    <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border.primary, padding: spacing.md }}>
      {/* Weight Chart */}
      <Text style={{ fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: 8 }}>
        Peso promedio por sesión
      </Text>
      <LineChart
        data={{
          labels,
          datasets: [{ data: weightValues }],
        }}
        width={chartWidth}
        height={160}
        yAxisSuffix={` ${unit}`}
        yAxisLabel=""
        chartConfig={{
          backgroundColor: 'transparent',
          backgroundGradientFrom: colors.bg.elevated,
          backgroundGradientTo: colors.bg.elevated,
          decimalPlaces: weightDecimals,
          color: (opacity = 1) => `rgba(74, 111, 165, ${opacity})`, // steel blue
          labelColor: (opacity = 1) => `rgba(158, 165, 180, ${opacity})`,
          style: { borderRadius: borderRadius.md },
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
        style={{ marginVertical: spacing.sm, borderRadius: borderRadius.md, marginLeft: -spacing.md }}
        formatYLabel={(value) => {
          const num = parseFloat(value);
          return num >= 1000 ? `${(num / 1000).toFixed(1)}k` : value;
        }}
        withInnerLines={true}
        withOuterLines={false}
        withVerticalLines={false}
        withHorizontalLines={true}
        segments={4}
      />

      {/* Reps Chart */}
      <Text style={{ fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginTop: spacing.md, marginBottom: 8 }}>
        Repeticiones promedio por sesión
      </Text>
      <LineChart
        data={{
          labels,
          datasets: [{ data: repValues }],
        }}
        width={chartWidth}
        height={160}
        yAxisSuffix=" reps"
        yAxisLabel=""
        chartConfig={{
          backgroundColor: 'transparent',
          backgroundGradientFrom: colors.bg.elevated,
          backgroundGradientTo: colors.bg.elevated,
          decimalPlaces: repDecimals,
          color: (opacity = 1) => `rgba(130, 200, 150, ${opacity})`, // green accent
          labelColor: (opacity = 1) => `rgba(158, 165, 180, ${opacity})`,
          style: { borderRadius: borderRadius.md },
          propsForDots: {
            r: '4',
            strokeWidth: '2',
            stroke: '#82c896',
            fill: colors.bg.elevated,
          },
          propsForBackgroundLines: {
            stroke: colors.border.primary,
            strokeDasharray: '4 4',
          },
        }}
        bezier
        style={{ marginVertical: spacing.sm, borderRadius: borderRadius.md, marginLeft: -spacing.md }}
        withInnerLines={true}
        withOuterLines={false}
        withVerticalLines={false}
        withHorizontalLines={true}
        segments={4}
      />
    </View>
  );
}
