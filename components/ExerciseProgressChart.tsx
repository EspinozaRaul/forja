import { View, Text, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts, fontSizes, borderWidths } from '../lib/theme/tokens';
import { MONTHS_ES } from '../lib/constants/months';
import { SimpleLineChart } from './SimpleLineChart';
import { EmptyState } from './ui/EmptyState';
import type { ExerciseProgressionDataPoint } from '../lib/db/queries';

interface ExerciseProgressChartProps {
  data: ExerciseProgressionDataPoint[];
  unit?: string;
}

function formatDate(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  const day = d.getDate();
  return `${day} ${MONTHS_ES[d.getMonth()]}`;
}

export function ExerciseProgressChart({ data, unit = 'kg' }: ExerciseProgressChartProps) {
  const { t } = useTranslation();
  
  if (data.length === 0) {
    return (
      <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, borderWidth: borderWidths.thin, borderColor: colors.border.primary, padding: spacing.md }}>
        <EmptyState
          icon="trending-up"
          title={t('progress.exercises.noData')}
          message={t('progress.exercises.startTraining')}
        />
      </View>
    );
  }

  // Sort by date ascending
  const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Format for charts
  const weightData = sorted.map(d => ({
    date: formatDate(d.date),
    value: d.avgWeight ?? 0,
  }));

  const repData = sorted.map(d => ({
    date: formatDate(d.date),
    value: d.avgReps ?? 0,
  }));

  return (
    <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, borderWidth: borderWidths.thin, borderColor: colors.border.primary, padding: spacing.md }}>
      {/* Weight Chart */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
        <View style={{ width: 12, height: 12, borderRadius: borderRadius.md, backgroundColor: colors.accent.primary, marginRight: spacing.sm }} />
        <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
          {t('progress.exercises.avgWeightPerSession')}
        </Text>
      </View>
      <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.muted, marginBottom: spacing.sm }}>
        {t('progress.exercises.eachPointOneSession')}
      </Text>
      <SimpleLineChart
        data={weightData}
        unit={unit}
        color={colors.accent.primary}
        height={160}
      />

      {/* Reps Chart */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.xs }}>
        <View style={{ width: 12, height: 12, borderRadius: borderRadius.md, backgroundColor: colors.chart.reps, marginRight: spacing.sm }} />
        <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
          {t('progress.exercises.avgRepsPerSession')}
        </Text>
      </View>
      <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.muted, marginBottom: spacing.sm }}>
        {t('progress.exercises.eachPointOneSession')}
      </Text>
      <SimpleLineChart
        data={repData}
        unit="reps"
        color={colors.chart.reps}
        height={160}
      />
    </View>
  );
}
