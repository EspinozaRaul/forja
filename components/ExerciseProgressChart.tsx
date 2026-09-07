import { View, Text, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts } from '../lib/theme/tokens';
import { SimpleLineChart } from './SimpleLineChart';
import { EmptyState } from './ui/EmptyState';
import type { ExerciseProgressionDataPoint } from '../lib/db/queries';

interface ExerciseProgressChartProps {
  data: ExerciseProgressionDataPoint[];
  unit?: string;
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDate(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  const day = d.getDate();
  return `${day} ${MONTHS_ES[d.getMonth()]}`;
}

export function ExerciseProgressChart({ data, unit = 'kg' }: ExerciseProgressChartProps) {
  const { t } = useTranslation();
  
  if (data.length === 0) {
    return (
      <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border.primary, padding: spacing.md }}>
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
    <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border.primary, padding: spacing.md }}>
      {/* Weight Chart */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.accent.primary, marginRight: 8 }} />
        <Text style={{ fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
          {t('progress.exercises.avgWeightPerSession')}
        </Text>
      </View>
      <Text style={{ fontSize: 11, fontFamily: fonts.body, color: colors.text.muted, marginBottom: 8 }}>
        {t('progress.exercises.eachPointOneSession')}
      </Text>
      <SimpleLineChart
        data={weightData}
        unit={unit}
        color={colors.accent.primary}
        height={160}
      />

      {/* Reps Chart */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: 4 }}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#82c896', marginRight: 8 }} />
        <Text style={{ fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
          {t('progress.exercises.avgRepsPerSession')}
        </Text>
      </View>
      <Text style={{ fontSize: 11, fontFamily: fonts.body, color: colors.text.muted, marginBottom: 8 }}>
        {t('progress.exercises.eachPointOneSession')}
      </Text>
      <SimpleLineChart
        data={repData}
        unit="reps"
        color="#82c896"
        height={160}
      />
    </View>
  );
}
