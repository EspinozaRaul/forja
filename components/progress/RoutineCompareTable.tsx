import { View, Text, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts, fontSizes } from '../../lib/theme/tokens';
import type { RoutineComparisonData, ExerciseComparisonRow, RoutineSessionSet } from '../../lib/progress';

interface RoutineCompareTableProps {
  data: RoutineComparisonData;
  /** Per-period session dates for column headers. */
  periodDates: { [periodKey: string]: string[] };
}

// ─── Helpers ──────────────────────────────────────────

function formatSet(set: RoutineSessionSet): string {
  const parts: string[] = [];
  if (set.weight != null) parts.push(`${set.weight}kg`);
  if (set.reps != null) parts.push(`${set.reps}`);
  if (parts.length === 0) return '-';
  const base = parts.join('x');
  if (set.rir != null) return `${base} RIR ${set.rir}`;
  return base;
}

function formatShortDate(dateStr: string, t: (key: string) => string): string {
  // dateStr is "YYYY-MM" or full ISO; extract day+month
  const d = new Date(dateStr);
  const day = d.getDate();
  const MONTHS = [
    t('progress.months.janShort'), t('progress.months.febShort'), t('progress.months.marShort'),
    t('progress.months.aprShort'), t('progress.months.mayShort'), t('progress.months.junShort'),
    t('progress.months.julShort'), t('progress.months.augShort'), t('progress.months.sepShort'),
    t('progress.months.octShort'), t('progress.months.novShort'), t('progress.months.decShort'),
  ];
  return `${day} ${MONTHS[d.getMonth()]}`;
}

function StatusBadge({ status, t }: { status: ExerciseComparisonRow['status']; t: (key: string) => string }) {
  if (status === 'unchanged') return null;

  const config = {
    new: { label: t('progress.routineCompare.new'), color: colors.success },
    removed: { label: t('progress.routineCompare.removed'), color: colors.error },
    'order-changed': { label: t('progress.routineCompare.reordered'), color: colors.warning },
  } as const;

  const { label, color } = config[status];

  return (
    <View
      style={{
        backgroundColor: `${color}26`,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.xs + 2,
        paddingVertical: 1,
      }}
    >
      <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodyMedium, color }}>
        {label}
      </Text>
    </View>
  );
}

function OrderDelta({ delta }: { delta: number | null }) {
  if (delta === null || delta === 0) return null;
  const arrow = delta < 0 ? '▲' : '▼';
  const color = delta < 0 ? colors.success : colors.error;
  return (
    <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodyMedium, color, marginLeft: spacing.xs }}>
      {arrow} {Math.abs(delta)}
    </Text>
  );
}

function MethodBadge({ method }: { method: string | null }) {
  if (!method || method === 'linear') return null;
  const LABELS: Record<string, string> = {
    dropset: 'DS',
    rest_pause: 'RP',
    cluster: 'CL',
    superset: 'SS',
    partial: 'PT',
    pyramid_up: 'PU',
    pyramid_down: 'PD',
  };
  return (
    <View
      style={{
        backgroundColor: colors.accent.muted,
        borderRadius: borderRadius.sm,
        paddingHorizontal: spacing.xs,
        paddingVertical: 1,
        marginTop: 2,
      }}
    >
      <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodyMedium, color: colors.accent.primary }}>
        {LABELS[method] ?? method}
      </Text>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────

const CELL_WIDTH = 140;
const STICKY_WIDTH = 120;

/**
 * Comparison table: exercise rows x period columns.
 * Each cell shows ALL sessions for that exercise in that period.
 * Sticky exercise name column on the left.
 */
export function RoutineCompareTable({ data, periodDates }: RoutineCompareTableProps) {
  const { t } = useTranslation();
  
  if (data.exercises.length === 0) {
    return (
      <View
        style={{
          backgroundColor: colors.bg.card,
          borderRadius: borderRadius.lg,
          borderWidth: 1,
          borderColor: colors.border.primary,
          padding: spacing.lg,
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: fontSizes.sm, color: colors.text.muted }}>
          {t('progress.routineCompare.noData')}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: colors.bg.card,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border.primary,
        overflow: 'hidden',
      }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Period header row */}
          <View style={{ flexDirection: 'row' }}>
            {/* Sticky exercise column header */}
            <View
              style={{
                width: STICKY_WIDTH,
                backgroundColor: colors.bg.elevated,
                padding: spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.border.divider,
                borderRightWidth: 1,
                borderRightColor: colors.border.divider,
              }}
            >
              <Text
                style={{
                  fontSize: fontSizes.xs,
                  fontFamily: fonts.bodyMedium,
                  color: colors.text.muted,
                }}
              >
                Ejercicio
              </Text>
            </View>

            {/* Period column headers */}
            {data.periods.map((period) => (
              <View
                key={period.periodKey}
                style={{
                  width: CELL_WIDTH,
                  backgroundColor: colors.bg.elevated,
                  padding: spacing.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border.divider,
                }}
              >
                <Text
                  style={{
                    fontSize: fontSizes.xs,
                    fontFamily: fonts.bodySemiBold,
                    color: colors.text.primary,
                  }}
                >
                  {period.label}
                </Text>
                {/* Show session dates as sub-headers */}
                {periodDates[period.periodKey]?.map((dateStr, i) => (
                  <Text
                    key={`${period.periodKey}-${i}`}
                    style={{
                      fontSize: fontSizes.xs,
                      fontFamily: fonts.body,
                      color: colors.text.muted,
                      marginTop: 2,
                    }}
                  >
                    {formatShortDate(dateStr, t)}
                  </Text>
                ))}
              </View>
            ))}
          </View>

          {/* Exercise rows */}
          {data.exercises.map((exercise, rowIdx) => (
            <View
              key={exercise.exerciseId}
              style={{
                flexDirection: 'row',
                borderBottomWidth: rowIdx < data.exercises.length - 1 ? 1 : 0,
                borderBottomColor: colors.border.divider,
              }}
            >
              {/* Sticky exercise name */}
              <View
                style={{
                  width: STICKY_WIDTH,
                  padding: spacing.sm,
                  backgroundColor: colors.bg.card,
                  borderRightWidth: 1,
                  borderRightColor: colors.border.divider,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text
                    style={{
                      fontSize: fontSizes.xs,
                      fontFamily: fonts.bodySemiBold,
                      color: colors.text.primary,
                      flex: 1,
                    }}
                    numberOfLines={2}
                  >
                    {exercise.exerciseName}
                  </Text>
                  <OrderDelta delta={exercise.orderDelta} />
                </View>
                <StatusBadge status={exercise.status} t={t} />
              </View>

              {/* Period cells */}
              {data.periods.map((period) => {
                const periodData = exercise.periods[period.periodKey];
                const sessions = periodData?.sessions ?? [];
                return (
                  <View
                    key={period.periodKey}
                    style={{
                      width: CELL_WIDTH,
                      padding: spacing.sm,
                      backgroundColor: colors.bg.card,
                    }}
                  >
                    {sessions.length === 0 ? (
                      <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted }}>
                        -
                      </Text>
                    ) : (
                      sessions.map((session, sIdx) => (
                        <View
                          key={sIdx}
                          style={{
                            marginBottom: sIdx < sessions.length - 1 ? spacing.xs : 0,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: fontSizes.xs,
                              fontFamily: fonts.bodyMedium,
                              color: colors.text.muted,
                              marginBottom: 2,
                            }}
                          >
                            {formatShortDate(session.date, t)}
                          </Text>
                          {session.sets.map((set, setIdx) => (
                            <Text
                              key={setIdx}
                              style={{
                                fontSize: fontSizes.xs,
                                fontFamily: fonts.body,
                                color: colors.text.secondary,
                              }}
                            >
                              {formatSet(set)}
                            </Text>
                          ))}
                        </View>
                      ))
                    )}
                    <MethodBadge method={periodData?.method ?? null} />
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
