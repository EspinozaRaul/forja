import { View, Text, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts, fontSizes, borderWidths } from '../lib/theme/tokens';
import { CHART } from '../lib/constants/layout';
import { CHART_CONFIG } from '../lib/constants/config';

interface DataPoint {
  date: string;
  value: number;
}

interface SimpleLineChartProps {
  data: DataPoint[];
  title?: string;
  unit?: string;
  color?: string;
  height?: number;
}

function formatValue(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toString();
}

export function SimpleLineChart({ 
  data, 
  title, 
  unit = '', 
  color = colors.accent.primary,
  height = 180 
}: SimpleLineChartProps) {
  const { t } = useTranslation();
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - spacing.lg * 2 - spacing.md * 2;
  const chartHeight = height;
  const padding = CHART_CONFIG.PADDING;
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  if (data.length === 0) {
    return (
      <View style={{ backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, padding: spacing.sm, borderWidth: borderWidths.thin, borderColor: colors.border.primary }}>
        {title && (
          <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.sm }}>{title}</Text>
        )}
        <View style={{ height: CHART.HEIGHT_EMPTY, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.text.muted, fontSize: fontSizes.sm, fontFamily: fonts.body }}>{t('progress.noDataYet')}</Text>
        </View>
      </View>
    );
  }

  const values = data.map(d => d.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = maxValue - minValue || 1;

  // Generate points
  const dotRadius = 4;
  const points = data.map((d, i) => ({
    x: padding.left + dotRadius + (i / (data.length - 1 || 1)) * (innerWidth - dotRadius * 2),
    y: padding.top + innerHeight - ((d.value - minValue) / range) * innerHeight,
    value: d.value,
    label: d.date,
  }));

  // Y-axis labels — round to whole numbers for discrete counts
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    value: Math.round(minValue + range * pct),
    y: padding.top + innerHeight - pct * innerHeight,
  }));

  // X-axis labels (show max 5)
  const xStep = Math.max(1, Math.floor(data.length / CHART_CONFIG.MAX_X_LABELS));
  const xLabels = data.filter((_, i) => i % xStep === 0 || i === data.length - 1).map((d, i, arr) => {
    const idx = data.indexOf(d);
    return {
      label: d.date,
      x: points[idx].x,
    };
  });

  return (
    <View style={{ backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, padding: spacing.sm, borderWidth: borderWidths.thin, borderColor: colors.border.primary }}>
      {title && (
        <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.sm }}>{title}</Text>
      )}
      
      {/* Chart */}
      <View style={{ width: chartWidth, height: chartHeight, overflow: 'hidden' }}>
        {/* Grid lines */}
        {yLabels.map((label, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: padding.left,
              right: padding.right,
              top: label.y,
              height: 1,
              backgroundColor: colors.border.primary,
              opacity: 0.3,
            }}
          />
        ))}

        {/* Line - using overlapping dots to simulate a line */}
        {points.map((point, i) => {
          if (i === 0) return null;
          const prev = points[i - 1];
          return (
            <View
              key={i}
              style={{
                position: 'absolute',
                left: prev.x,
                top: prev.y - 1,
                width: Math.sqrt(Math.pow(point.x - prev.x, 2) + Math.pow(point.y - prev.y, 2)),
                height: 2,
                backgroundColor: color,
                transformOrigin: 'left center',
                transform: [{ rotate: `${Math.atan2(point.y - prev.y, point.x - prev.x) * (180 / Math.PI)}deg` }],
              }}
            />
          );
        })}

        {/* Data points */}
        {points.map((point, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: point.x - 4,
              top: point.y - 4,
              width: 8,
              height: 8,
              borderRadius: borderRadius.sm,
              backgroundColor: color,
              borderWidth: borderWidths.thick,
              borderColor: colors.bg.elevated,
            }}
          />
        ))}

        {/* Y-axis labels */}
        {yLabels.map((label, i) => (
          <Text
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              top: label.y - 6,
              fontSize: fontSizes.xs2, fontFamily: fonts.body,
              color: colors.text.muted,
              width: padding.left - 4,
              textAlign: 'right',
            }}
          >
            {formatValue(label.value)}
          </Text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((label, i) => (
          <Text
            key={i}
            style={{
              position: 'absolute',
              left: Math.max(0, Math.min(label.x - 15, chartWidth - 34)),
              bottom: 5,
              fontSize: fontSizes.xs2, fontFamily: fonts.body,
              color: colors.text.muted,
              width: 30,
              textAlign: 'center',
            }}
            numberOfLines={1}
          >
            {label.label}
          </Text>
        ))}
      </View>

      {/* Unit label */}
      {unit && (
        <Text style={{ fontSize: fontSizes.xs2, fontFamily: fonts.body, color: colors.text.muted, marginTop: spacing.xs, textAlign: 'center' }}>
          {unit}
        </Text>
      )}
    </View>
  );
}
