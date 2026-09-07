import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts, fontSizes, borderWidths } from '../lib/theme/tokens';
import { CHART } from '../lib/constants/layout';
import { ANIMATION_CONFIG, CHART_CONFIG } from '../lib/constants/config';
import { MONTHS_ES } from '../lib/constants/months';
import { EmptyState } from './ui/EmptyState';
import { mapWeightToY, mapRepsToSize, mapRirToOpacity } from '../lib/utils/progression-mapping';
import type { ExerciseProgressionDataPoint } from '../lib/db/queries';

// ─── Date Formatting ───────────────────────────────────

function formatDateDD(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}/${MONTHS_ES[d.getMonth()]}`;
}

function formatDateLong(date: Date): string {
  const d = date instanceof Date ? date : new Date(date);
  const day = d.getDate();
  return `${day} de ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}

function formatWeightValue(weight: number | null, noDataLabel: string): string {
  if (weight == null) return noDataLabel;
  return `${Math.round(weight)}`;
}

function formatRepsValue(reps: number | null, noDataLabel: string): string {
  if (reps == null) return noDataLabel;
  return `${Math.round(reps)}`;
}

function formatRirValue(rir: number | null, noDataLabel: string): string {
  if (rir == null) return noDataLabel;
  return `${Math.round(rir)}`;
}

// ─── Component ─────────────────────────────────────────

const CHART_HEIGHT = 140;
const BUBBLE_COLUMN_WIDTH = 48;
const TOOLTIP_WIDTH = 180;

export interface ProgressionBubbleProps {
  data: ExerciseProgressionDataPoint[];
  exerciseName: string;
  unit?: string;
}

export function ProgressionBubble({ data, exerciseName, unit = 'kg' }: ProgressionBubbleProps) {
  const { t } = useTranslation();
  const [tooltipIndex, setTooltipIndex] = useState<number | null>(null);

  const handleLongPress = useCallback((index: number) => {
    setTooltipIndex(index);
  }, []);

  const handleTooltipClose = useCallback(() => {
    setTooltipIndex(null);
  }, []);

  const needsScroll = data.length >= CHART_CONFIG.SCROLL_THRESHOLD;

  const maxWeight = useMemo(() => {
    const weights = data.map((d) => d.avgWeight).filter((w): w is number => w != null);
    return weights.length > 0 ? Math.max(...weights) : 0;
  }, [data]);

  if (data.length < 2) {
    return (
      <EmptyState
        icon={<Ionicons name="bar-chart-outline" size={48} color={colors.text.muted} />}
        title={t('progress.exercises.noProgression')}
        message={t('progress.exercises.needAtLeast2Sessions')}
      />
    );
  }

  return (
    <View>
      <ScrollView
        horizontal={needsScroll}
        showsHorizontalScrollIndicator={false}
        style={{ overflow: 'hidden' }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            minWidth: needsScroll ? data.length * BUBBLE_COLUMN_WIDTH : undefined,
            height: CHART_HEIGHT + 30,
            paddingTop: spacing.sm,
          }}
        >
          {/* Y-axis gridlines + bubbles */}
          <View style={{ flexDirection: 'row', flex: 1, alignItems: 'flex-end' }}>
            {/* Y-axis labels column */}
            <View
              style={{
                width: CHART.Y_AXIS_WIDTH,
                height: CHART_HEIGHT,
                justifyContent: 'space-between',
                paddingBottom: spacing.xs,
              }}
            >
              {[100, 50, 0].map((pct) => (
                <Text
                  key={`y-${pct}`}
                  style={{
                    fontSize: fontSizes.xs,
                    fontFamily: fonts.body,
                    color: colors.text.muted,
                    textAlign: 'right',
                  }}
                >
                  {Math.round((maxWeight * pct) / 100)}
                </Text>
              ))}
            </View>

            {/* Gridlines */}
            <View
              style={{
                position: 'absolute',
                left: 40,
                right: 0,
                top: 0,
                height: CHART_HEIGHT,
                justifyContent: 'space-between',
              }}
            >
              {[0, 1, 2].map((i) => (
                <View
                  key={`grid-${i}`}
                  style={{
                    height: 1,
                    backgroundColor: colors.border.divider,
                    width: '100%',
                  }}
                />
              ))}
            </View>

            {/* Bubble columns */}
            {data.map((point, index) => (
              <BubbleColumn
                key={point.sessionId}
                point={point}
                index={index}
                maxWeight={maxWeight}
                chartHeight={CHART_HEIGHT}
                unit={unit}
                isTooltipVisible={tooltipIndex === index}
                onLongPress={handleLongPress}
                onTooltipClose={handleTooltipClose}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Tooltip overlay */}
      {tooltipIndex != null && data[tooltipIndex] && (
        <Tooltip
          point={data[tooltipIndex]}
          unit={unit}
          onClose={handleTooltipClose}
        />
      )}
    </View>
  );
}

// ─── Bubble Column ─────────────────────────────────────

interface BubbleColumnProps {
  point: ExerciseProgressionDataPoint;
  index: number;
  maxWeight: number;
  chartHeight: number;
  unit: string;
  isTooltipVisible: boolean;
  onLongPress: (index: number) => void;
  onTooltipClose: () => void;
}

function BubbleColumn({
  point,
  index,
  maxWeight,
  chartHeight,
  unit,
  isTooltipVisible,
  onLongPress,
  onTooltipClose,
}: BubbleColumnProps) {
  const scale = useSharedValue(0);

  // Entry animation
  useEffect(() => {
    scale.value = 0;
    scale.value = withDelay(
      index * ANIMATION_CONFIG.LIST_ITEM_DELAY,
      withTiming(1, { duration: ANIMATION_CONFIG.LIST_ITEM_DURATION, easing: Easing.out(Easing.cubic) })
    );
  }, [point.sessionId]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bubbleSize = mapRepsToSize(point.avgReps);
  const yPosition = mapWeightToY(point.avgWeight, chartHeight, maxWeight);
  const opacity = point.avgWeight == null ? 0.4 : mapRirToOpacity(point.avgRir);

  const longPress = Gesture.LongPress()
    .minDuration(ANIMATION_CONFIG.LONG_PRESS_DURATION)
    .onEnd(() => {
      runOnJS(onLongPress)(index);
    });

  return (
    <View
      style={{
        width: BUBBLE_COLUMN_WIDTH,
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: chartHeight,
      }}
    >
      {/* Bubble */}
      <GestureDetector gesture={longPress}>
        <Animated.View
          style={[
            {
              width: bubbleSize,
              height: bubbleSize,
              borderRadius: borderRadius.full,
              backgroundColor: colors.accent.primary,
              opacity,
              position: 'absolute',
              bottom: yPosition - bubbleSize / 2,
            },
            animatedStyle,
          ]}
        />
      </GestureDetector>

      {/* Date label */}
      <Text
        style={{
          fontSize: fontSizes.xs,
          fontFamily: fonts.body,
          color: colors.text.muted,
          position: 'absolute',
          bottom: -20,
          textAlign: 'center',
        }}
      >
        {formatDateDD(point.date)}
      </Text>
    </View>
  );
}

// ─── Tooltip ───────────────────────────────────────────

interface TooltipProps {
  point: ExerciseProgressionDataPoint;
  unit: string;
  onClose: () => void;
}

function Tooltip({ point, unit, onClose }: TooltipProps) {
  const { t } = useTranslation();
  const noDataLabel = t('progress.exercises.noData');
  
  return (
    <Pressable
      onPress={onClose}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: TOOLTIP_WIDTH,
        backgroundColor: colors.bg.elevated,
        borderRadius: borderRadius.md,
        borderWidth: borderWidths.thin,
        borderColor: colors.border.primary,
        padding: spacing.sm,
        zIndex: 10,
      }}
    >
      <Text
        style={{
          fontSize: fontSizes.xs,
          fontFamily: fonts.bodySemiBold,
          color: colors.text.primary,
          marginBottom: spacing.xs,
        }}
      >
        {formatDateLong(point.date)}
      </Text>
      <TooltipRow label={t('progress.maxWeight')} value={`${formatWeightValue(point.avgWeight, noDataLabel)} ${unit}`} />
      <TooltipRow label={t('session.reps')} value={formatRepsValue(point.avgReps, noDataLabel)} />
      <TooltipRow label={t('progress.exercises.rir')} value={formatRirValue(point.avgRir, noDataLabel)} />
      <TooltipRow label={t('progress.sets')} value={`${point.setCount}`} />
    </Pressable>
  );
}

function TooltipRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xxs }}>
      <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.muted }}>
        {label}
      </Text>
      <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodyMedium, color: colors.text.secondary }}>
        {value}
      </Text>
    </View>
  );
}
