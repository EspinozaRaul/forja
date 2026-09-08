import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts, fontSizes, borderWidths } from '../lib/theme/tokens';
import { CHART } from '../lib/constants/layout';
import { SimpleLineChart } from './SimpleLineChart';
import type { ProgressDataPoint } from '../lib/types';

interface ProgressChartProps {
  data: ProgressDataPoint[];
  title?: string;
  unit?: string;
  selectedWeek?: string | null;
  onBarPress?: (week: string) => void;
  embedded?: boolean;
}

export function ProgressChart({ data, title, unit = '', embedded = false }: ProgressChartProps) {
  const { t } = useTranslation();

  const containerStyle = embedded
    ? { backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, padding: spacing.sm, borderWidth: borderWidths.thin, borderColor: colors.border.primary }
    : { backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md + spacing.xs };

  if (data.length === 0) {
    return (
      <View style={containerStyle}>
        {title && (
          <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.sm }}>{title}</Text>
        )}
        <View style={{ height: CHART.HEIGHT_EMPTY, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.text.muted, fontSize: fontSizes.sm, fontFamily: fonts.body }}>{t('progress.noDataYet')}</Text>
        </View>
      </View>
    );
  }

  // Format dates for X-axis: "S34", "S35" etc.
  const chartData = data.map(d => {
    const week = d.date.split('-')[1] ?? d.date.slice(-2);
    return {
      date: `S${week.replace('W', '')}`,
      value: d.value,
    };
  });

  return (
    <View style={containerStyle}>
      {title && (
        <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.xs }}>{title}</Text>
      )}
      <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.muted, marginBottom: spacing.sm }}>
        {t('progress.chartWeekHint')}
      </Text>
      <SimpleLineChart
        data={chartData}
        unit={unit}
        color={colors.accent.primary}
        height={160}
      />
    </View>
  );
}
