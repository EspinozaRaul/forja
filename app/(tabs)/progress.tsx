import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useExercises, useExerciseSessions } from '../../lib/hooks/useExercises';
import { useGlobalStats } from '../../lib/hooks/useGlobalStats';
import {
  useTotalVolumeByWeek,
  useSessionCountByWeek,
  useWeeklySessions,
  useSessionsByMonth,
  useSessionMonthIndex,
  useSessionCompare,
  useMostUsedExercises,
} from '../../lib/hooks/useProgress';
import { useSettings } from '../../lib/utils/settings';
import { ProgressChart } from '../../components/ProgressChart';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDuration, formatVolume } from '../../lib/utils/format';
import { resolveUnit, formatWeight } from '../../lib/utils/weight-unit';
import type { WeightUnit } from '../../lib/utils/weight-unit';
import { colors, spacing, borderRadius, fonts, fontSizes } from '../../lib/theme/tokens';
import { EXERCISE_NAMES_ES } from '../../lib/db/exercise-names-es';
import { buildMonthGrid, monthLabel, addMonths, compareSessions } from '../../lib/progress';
import type { SessionByMonth, SessionDetail, SessionComparison, ExerciseComparison, MostUsedExercise } from '../../lib/progress';
import type { ProgressDataPoint } from '../../lib/types';
import type { WeeklySessionDetail } from '../../lib/db/queries';

type DateRange = '4weeks' | '12weeks' | 'all';

// ─── Week helpers ──────────────────────────────────────
// Chart data points are "YYYY-WW" week keys from strftime('%Y-%W') — Monday
// first, week 00-53. Two keys are comparable only via an absolute week index,
// never lexically (the old code compared "YYYY-MM" month strings against them).
const WEEK_BUCKETS = 54;

function weekKeyToNumber(weekKey: string): number {
  const [year, week] = weekKey.split('-');
  return Number(year) * WEEK_BUCKETS + Number(week);
}

function currentWeekKey(): string {
  // The DB computes week keys with strftime('%Y-%W', startedAt, 'unixepoch'),
  // i.e. on the UTC calendar date. Replicate %W exactly: week 01 starts on the
  // first Monday of the year, earlier days are week 00.
  const now = new Date();
  const year = now.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const jan1Dow = new Date(jan1).getUTCDay();
  const firstMondayOffset = (8 - jan1Dow) % 7;
  const dayOfYear = Math.floor(
    (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - jan1) / 86400000
  );
  const week = Math.max(0, Math.floor((dayOfYear - firstMondayOffset) / 7) + 1);
  return `${year}-${String(week).padStart(2, '0')}`;
}

// ─── Spanish formatting helpers ────────────────────────
const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAY_HEADER = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function formatDayShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDay.getTime()) / 86400000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  return `${DAYS_ES[d.getDay()]} ${d.getDate()} ${MONTHS_ES_SHORT[d.getMonth()]}`;
}

function formatTotalTime(seconds: number): string {
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
  return formatDuration(seconds);
}

function signedNumber(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function deltaMeta(delta: number): { arrow: string; color: string } {
  if (delta > 0) return { arrow: '▲', color: colors.success };
  if (delta < 0) return { arrow: '▼', color: colors.error };
  return { arrow: '—', color: colors.text.muted };
}

function signedDelta(delta: number | null, unit: WeightUnit, raw = false): string {
  if (delta == null) return '—';
  const abs = raw ? `${Math.abs(delta)}` : formatVolume(Math.abs(delta), unit);
  return `${delta > 0 ? '+' : ''}${abs}`;
}

// ─── Small presentational components ───────────────────
const cardStyle = {
  backgroundColor: colors.bg.card,
  borderRadius: borderRadius.lg,
  padding: spacing.md,
  borderWidth: 1,
  borderColor: colors.border.primary,
};

function SectionTitle({ children }: { children: string }) {
  return (
    <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md }}>
      {children}
    </Text>
  );
}

function StatCard({ label, value, valueColor }: { label: string; value: string; valueColor: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg.elevated,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border.primary,
      }}
    >
      <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodyMedium, color: colors.text.muted, marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 22, fontFamily: fonts.display, color: valueColor }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function SessionRow({
  session,
  unit,
  isCompareA,
  isCompareB,
  onOpen,
  onCompare,
}: {
  session: SessionByMonth;
  unit: WeightUnit;
  isCompareA: boolean;
  isCompareB: boolean;
  onOpen: () => void;
  onCompare: () => void;
}) {
  const compareActive = isCompareA || isCompareB;
  return (
    <Pressable
      onPress={onOpen}
      style={{
        backgroundColor: colors.bg.elevated,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: compareActive ? colors.accent.primary : colors.border.primary,
        padding: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
            {formatDayShort(session.startedAt)}
          </Text>
          <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.muted }}>
            {session.exerciseCount} ejercicios
            {session.duration != null ? ` · ${formatDuration(session.duration)}` : ''}
            {' · '}
            {formatVolume(session.totalVolume, unit)}
          </Text>
        </View>
        <Pressable
          onPress={onCompare}
          hitSlop={10}
          style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: borderRadius.sm,
            borderWidth: 1,
            borderColor: compareActive ? colors.accent.primary : colors.border.primary,
          }}
        >
          <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodyMedium, color: compareActive ? colors.accent.primary : colors.text.muted }}>
            Comparar
          </Text>
        </Pressable>
        <Text style={{ fontSize: 18, color: colors.text.muted }}>›</Text>
      </View>
    </Pressable>
  );
}

function MostUsedExerciseRow({
  name,
  sessionCount,
  setCount,
  maxWeight,
  unit,
  onPress,
  isLast,
}: {
  name: string;
  sessionCount: number;
  setCount: number;
  maxWeight: number | null;
  unit: WeightUnit;
  onPress: () => void;
  isLast: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm + 2,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border.divider,
      }}
    >
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodySemiBold, color: colors.text.primary }} numberOfLines={1}>
          {name}
        </Text>
        <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.muted }}>
          {sessionCount} sesiones · {setCount} series
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
        <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.display, color: colors.text.primary }}>
          {formatWeight(maxWeight, unit)}
        </Text>
        <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodyMedium, color: colors.text.muted }}>máx</Text>
      </View>
      <Text style={{ fontSize: 16, color: colors.text.muted }}>›</Text>
    </Pressable>
  );
}

function CalendarCard({
  year,
  month,
  grid,
  daysWithSessions,
  selectedDay,
  sessionCount,
  onDayPress,
  onMonthChange,
}: {
  year: number;
  month: number;
  grid: (number | null)[];
  daysWithSessions: Set<number>;
  selectedDay: number | null;
  sessionCount: number;
  onDayPress: (day: number) => void;
  onMonthChange: (delta: number) => void;
}) {
  const cellWidth = `${100 / 7}%` as `${number}%`;
  const cell = {
    width: cellWidth,
    aspectRatio: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 3,
  };

  return (
    <View style={cardStyle}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Pressable
          onPress={() => onMonthChange(-1)}
          hitSlop={10}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.md, backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.primary }}
        >
          <Text style={{ fontSize: 20, color: colors.text.secondary }}>‹</Text>
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
            {monthLabel(year, month)}
          </Text>
          <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.muted, marginTop: 2 }}>
            {sessionCount} entrenamientos
          </Text>
        </View>
        <Pressable
          onPress={() => onMonthChange(1)}
          hitSlop={10}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.md, backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.primary }}
        >
          <Text style={{ fontSize: 20, color: colors.text.secondary }}>›</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: spacing.xs }}>
        {WEEKDAY_HEADER.map((d) => (
          <Text key={d} style={{ width: cellWidth, textAlign: 'center', fontSize: fontSizes.xs, fontFamily: fonts.bodyMedium, color: colors.text.muted }}>
            {d}
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {grid.map((day, index) => {
          if (day == null) {
            return <View key={`empty-${index}`} style={cell} />;
          }
          const hasSession = daysWithSessions.has(day);
          const isSelected = selectedDay === day;
          return (
            <Pressable
              key={day}
              onPress={() => onDayPress(day)}
              style={[
                cell,
                hasSession ? { backgroundColor: colors.accent.muted, borderRadius: borderRadius.sm } : null,
                isSelected ? { backgroundColor: colors.accent.primary, borderRadius: borderRadius.sm } : null,
              ]}
            >
              <Text
                style={{
                  fontSize: fontSizes.sm,
                  fontFamily: isSelected ? fonts.bodySemiBold : fonts.body,
                  color: isSelected ? colors.bg.primary : hasSession ? colors.text.primary : colors.text.secondary,
                }}
              >
                {day}
              </Text>
              {hasSession ? (
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: borderRadius.full,
                    backgroundColor: isSelected ? colors.bg.primary : colors.ember.primary,
                  }}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Metric({
  label,
  a,
  b,
  delta,
  unit,
  mode,
}: {
  label: string;
  a?: number | null;
  b?: number | null;
  delta: number | null;
  unit?: WeightUnit;
  mode: 'weight' | 'reps' | 'volume';
}) {
  const formatValue = (value: number | null | undefined): string => {
    if (value == null) return '—';
    if (mode === 'weight') return formatWeight(value, unit ?? 'kg');
    return String(value);
  };

  const deltaColor = delta == null ? colors.text.muted : delta > 0 ? colors.success : delta < 0 ? colors.error : colors.text.secondary;

  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodyMedium, color: colors.text.muted }}>{label}</Text>
      {mode === 'volume' ? (
        <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodySemiBold, color: deltaColor }}>
          {delta == null ? '—' : `${deltaMeta(delta).arrow} ${signedDelta(delta, unit ?? 'kg')}`}
        </Text>
      ) : (
        <>
          <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.body, color: colors.text.primary }}>
            {formatValue(a)} → {formatValue(b)}
          </Text>
          <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodyMedium, color: deltaColor }}>
            {delta == null ? '—' : `${deltaMeta(delta).arrow} ${signedDelta(delta, unit ?? 'kg', true)}`}
          </Text>
        </>
      )}
    </View>
  );
}

function Tag({ text, color }: { text: string; color: string }) {
  return (
    <View
      style={{
        backgroundColor: `${color}26`,
        borderRadius: borderRadius.full,
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
      }}
    >
      <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodyMedium, color }}>{text}</Text>
    </View>
  );
}

function CompareExerciseRow({ cmp, unit }: { cmp: ExerciseComparison; unit: WeightUnit }) {
  const onlyInB = cmp.presentInB && !cmp.presentInA;
  const onlyInA = cmp.presentInA && !cmp.presentInB;
  return (
    <View
      style={{
        backgroundColor: colors.bg.elevated,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border.primary,
        padding: spacing.sm,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodySemiBold, color: colors.text.primary, flex: 1 }} numberOfLines={1}>
          {cmp.name}
        </Text>
        {onlyInB ? <Tag text="nuevo" color={colors.success} /> : null}
        {onlyInA ? <Tag text="quitado" color={colors.error} /> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Metric label="Peso máx" a={cmp.bestWeightA} b={cmp.bestWeightB} delta={cmp.weightDelta} unit={unit} mode="weight" />
        <Metric label="Reps máx" a={cmp.bestRepsA} b={cmp.bestRepsB} delta={cmp.repsDelta} mode="reps" />
        <Metric label="Volumen" delta={cmp.volumeDelta} unit={unit} mode="volume" />
      </View>
    </View>
  );
}

function ComparePanel({
  aId,
  bId,
  sessionA,
  sessionB,
  comparison,
  unit,
  expanded,
  onToggleExpanded,
  onClose,
}: {
  aId: number | null;
  bId: number | null;
  sessionA: SessionDetail | null;
  sessionB: SessionDetail | null;
  comparison: SessionComparison | null;
  unit: WeightUnit;
  expanded: boolean;
  onToggleExpanded: () => void;
  onClose: () => void;
}) {
  const selectedCount = (aId != null ? 1 : 0) + (bId != null ? 1 : 0);

  return (
    <View style={cardStyle}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm }}>
        <Pressable onPress={onToggleExpanded} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
          <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>Comparar sesiones</Text>
          <Text style={{ fontSize: 14, color: colors.text.muted }}>{expanded ? '▾' : '▸'}</Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          style={{ backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border.primary, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}
        >
          <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodyMedium, color: colors.text.secondary }}>Cerrar comparación</Text>
        </Pressable>
      </View>

      {expanded ? (
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          {selectedCount < 2 ? (
            <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.body, color: colors.text.muted, textAlign: 'center', paddingVertical: spacing.md }}>
              Tocá Comparar en dos sesiones para compararlas.
            </Text>
          ) : null}

          {aId != null && bId != null && (!sessionA || !sessionB || !comparison) ? (
            <LoadingSpinner message="Comparando sesiones…" />
          ) : sessionA && sessionB && comparison ? (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.md,
                  backgroundColor: colors.bg.elevated,
                  borderRadius: borderRadius.md,
                  borderWidth: 1,
                  borderColor: colors.border.primary,
                  padding: spacing.sm,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodyMedium, color: colors.text.muted }}>Δ Volumen</Text>
                  <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodySemiBold, color: deltaMeta(comparison.summary.volumeDelta).color }}>
                    {deltaMeta(comparison.summary.volumeDelta).arrow} {signedDelta(comparison.summary.volumeDelta, unit)}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodyMedium, color: colors.text.muted }}>Δ Series</Text>
                  <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodySemiBold, color: deltaMeta(comparison.summary.setsDelta).color }}>
                    {deltaMeta(comparison.summary.setsDelta).arrow} {signedNumber(comparison.summary.setsDelta)}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodyMedium, color: colors.text.muted }}>Ejercicios</Text>
                  <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
                    {comparison.summary.exercisesCount}
                  </Text>
                </View>
              </View>

              {comparison.perExercise.map((cmp) => (
                <CompareExerciseRow key={cmp.exerciseId} cmp={cmp} unit={cmp.unit === 'lbs' ? 'lbs' : 'kg'} />
              ))}
            </>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function WeekDetailPanel({
  week,
  sessions,
  loading,
  unit,
  onClose,
  onOpenSession,
}: {
  week: string;
  sessions: WeeklySessionDetail[] | undefined;
  loading: boolean;
  unit: WeightUnit;
  onClose: () => void;
  onOpenSession: (sessionId: number) => void;
}) {
  return (
    <View style={cardStyle}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
        <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>Semana {week}</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={{ fontSize: fontSizes.sm, color: colors.accent.primary }}>Cerrar</Text>
        </Pressable>
      </View>

      {loading ? (
        <LoadingSpinner message="Cargando semana…" />
      ) : !sessions || sessions.length === 0 ? (
        <Text style={{ fontSize: fontSizes.sm, color: colors.text.muted, textAlign: 'center', paddingVertical: spacing.md }}>
          Sin sesiones esta semana
        </Text>
      ) : (
        sessions.map((session) => (
          <Pressable
            key={session.sessionId}
            onPress={() => onOpenSession(session.sessionId)}
            style={{
              backgroundColor: colors.bg.elevated,
              borderRadius: borderRadius.sm,
              borderWidth: 1,
              borderColor: colors.border.primary,
              padding: spacing.md,
              marginBottom: spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
                {formatDayShort(session.startedAt)}
              </Text>
              {session.duration != null ? (
                <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted }}>{formatDuration(session.duration)}</Text>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.lg }}>
              <View>
                <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted }}>Volumen</Text>
                <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodySemiBold, color: colors.text.secondary }}>
                  {formatVolume(session.totalVolume, unit)}
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted }}>Ejercicios</Text>
                <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodySemiBold, color: colors.text.secondary }}>
                  {session.exerciseCount}
                </Text>
              </View>
            </View>
          </Pressable>
        ))
      )}
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────
export default function ProgressScreen() {
  const router = useRouter();
  const settings = useSettings();
  const unit = settings.data.weightUnit;

  const now = new Date();
  const [visibleYear, setVisibleYear] = useState(now.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dayExpanded, setDayExpanded] = useState(false);
  const [compare, setCompare] = useState<{ a: number | null; b: number | null }>({ a: null, b: null });
  const [compareExpanded, setCompareExpanded] = useState(true);
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>('12weeks');
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  const yearMonth = `${visibleYear}-${String(visibleMonth).padStart(2, '0')}`;

  const { data: globalStats, isLoading: statsLoading } = useGlobalStats();
  const { data: exercises } = useExercises();
  const { data: monthIndex } = useSessionMonthIndex();
  const { data: monthSessions, isLoading: monthLoading } = useSessionsByMonth(yearMonth);
  const { data: volumeData } = useTotalVolumeByWeek(selectedExerciseId ?? 0);
  const { data: sessionData } = useSessionCountByWeek(selectedExerciseId ?? undefined);
  const { data: weeklySessions, isLoading: weeklyLoading } = useWeeklySessions(selectedWeek, selectedExerciseId ?? undefined);
  const { data: compareResult } = useSessionCompare(compare.a ?? 0, compare.b ?? 0);
  const { data: exerciseSessions, isLoading: evolutionLoading } = useExerciseSessions(selectedExerciseId ?? 0);
  const { data: mostUsedExercises, isLoading: mostUsedLoading } = useMostUsedExercises(100);

  // Selector chips: only exercises with actual session usage, ordered by usage
  // desc (never the full catalog). The entry list shows the top 6.
  const selectorExercises = mostUsedExercises ?? [];
  const topUsedExercises = selectorExercises.slice(0, 6);

  const monthEntry = monthIndex?.find((m) => m.yearMonth === yearMonth);
  const grid = buildMonthGrid(visibleYear, visibleMonth);
  const daysWithSessions = new Set((monthSessions ?? []).map((s) => s.startedAt.getDate()));
  const selectedDaySessions =
    selectedDay != null ? (monthSessions ?? []).filter((s) => s.startedAt.getDate() === selectedDay) : [];

  // Day sessions: show 3 by default, expand all on demand (no infinite scroll).
  const visibleDaySessions = dayExpanded ? selectedDaySessions : selectedDaySessions.slice(0, 3);
  const hasMoreDaySessions = selectedDaySessions.length > 3;

  const monthSessionsDesc = [...(monthSessions ?? [])].sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime()
  );
  const recentMonthSessions = monthSessionsDesc.slice(0, 4);
  const hasMoreMonthSessions = monthSessionsDesc.length > 4;

  // FIX: data points are "YYYY-WW"; compare by absolute week index, not by a
  // "YYYY-MM" prefix (the old filter never matched and dropped everything).
  const filterByDateRange = (data: ProgressDataPoint[]): ProgressDataPoint[] => {
    if (dateRange === 'all') return data;
    const weeksToShow = dateRange === '4weeks' ? 4 : 12;
    const cutoff = weekKeyToNumber(currentWeekKey()) - weeksToShow;
    return data.filter((point) => weekKeyToNumber(point.date) >= cutoff);
  };

  const filteredVolumeData = filterByDateRange(volumeData ?? []);
  const filteredSessionData = filterByDateRange(sessionData ?? []);

  const selectedExercise = exercises?.find((e) => e.id === selectedExerciseId);
  const exerciseUnit = selectedExercise ? resolveUnit(selectedExercise.unit, unit) : unit;

  const exerciseNameMap: Record<number, string> = {};
  const exerciseUnitMap: Record<number, string> = {};
  for (const exercise of exercises ?? []) {
    exerciseNameMap[exercise.id] = EXERCISE_NAMES_ES[exercise.name] || exercise.name;
    exerciseUnitMap[exercise.id] = resolveUnit(exercise.unit, unit);
  }

  const comparison =
    compareResult?.a && compareResult.b
      ? compareSessions(compareResult.a.exercises, compareResult.b.exercises, exerciseNameMap, exerciseUnitMap)
      : null;

  const handleMonthChange = (delta: number) => {
    const next = addMonths(visibleYear, visibleMonth, delta);
    setVisibleYear(next.year);
    setVisibleMonth(next.month);
    setSelectedDay(null);
    setDayExpanded(false);
  };

  const handleBarPress = (week: string) => {
    setSelectedWeek(selectedWeek === week ? null : week);
  };

  const handleCompareToggle = (id: number) => {
    setCompare((current) => {
      if (current.a === id) return { ...current, a: null };
      if (current.b === id) return { ...current, b: null };
      if (current.a === null) return { ...current, a: id };
      if (current.b === null) return { ...current, b: id };
      return current;
    });
    setCompareExpanded(true);
  };

  const openSession = (id: number) => router.push(`/session/history/${id}`);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg.primary }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl }}
    >
      {/* 1. Global summary */}
      <View style={cardStyle}>
        <SectionTitle>Resumen</SectionTitle>
        {statsLoading ? (
          <LoadingSpinner message="Cargando estadísticas…" />
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <StatCard
              label="Volumen total"
              value={globalStats ? formatVolume(globalStats.totalVolume, unit) : '—'}
              valueColor={colors.accent.primary}
            />
            <StatCard
              label="Tiempo"
              value={globalStats ? formatTotalTime(globalStats.totalTime) : '—'}
              valueColor={colors.accent.primary}
            />
          </View>
        )}
      </View>

      {/* 2. Calendar of trained days */}
      <CalendarCard
        year={visibleYear}
        month={visibleMonth}
        grid={grid}
        daysWithSessions={daysWithSessions}
        selectedDay={selectedDay}
        sessionCount={monthEntry?.sessionCount ?? monthSessions?.length ?? 0}
        onDayPress={setSelectedDay}
        onMonthChange={handleMonthChange}
      />

      {/* Selected day sessions */}
      {selectedDay != null ? (
        <View style={cardStyle}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
              Entrenamientos del día {selectedDay}
            </Text>
            <Pressable onPress={() => setSelectedDay(null)} hitSlop={8}>
              <Text style={{ fontSize: fontSizes.sm, color: colors.accent.primary }}>Ver todo el mes</Text>
            </Pressable>
          </View>
          {monthLoading ? (
            <LoadingSpinner message="Cargando…" />
          ) : selectedDaySessions.length === 0 ? (
            <Text style={{ fontSize: fontSizes.sm, color: colors.text.muted, textAlign: 'center', paddingVertical: spacing.md }}>
              Sin entrenamientos este día
            </Text>
          ) : (
            <>
              <View style={{ gap: spacing.sm }}>
                {visibleDaySessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    unit={unit}
                    isCompareA={compare.a === session.id}
                    isCompareB={compare.b === session.id}
                    onOpen={() => openSession(session.id)}
                    onCompare={() => handleCompareToggle(session.id)}
                  />
                ))}
              </View>
              {hasMoreDaySessions ? (
                <Pressable
                  onPress={() => setDayExpanded((value) => !value)}
                  style={{
                    marginTop: spacing.sm,
                    backgroundColor: colors.bg.elevated,
                    borderRadius: borderRadius.md,
                    borderWidth: 1,
                    borderColor: colors.border.primary,
                    paddingVertical: spacing.sm,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodySemiBold, color: colors.accent.primary }}>
                    {dayExpanded ? 'Ver menos' : `Ver más (${selectedDaySessions.length})`}
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {/* 3. Sessions of the visible month */}
      <View style={cardStyle}>
        <SectionTitle>Sesiones del mes</SectionTitle>
        {monthLoading ? (
          <LoadingSpinner message="Cargando sesiones…" />
        ) : !monthSessions || monthSessions.length === 0 ? (
          <EmptyState
            title="Sin entrenamientos este mes"
            message="Entrená para empezar a ver tu progreso aquí."
          />
        ) : (
          <>
            <View style={{ gap: spacing.sm }}>
              {recentMonthSessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  unit={unit}
                  isCompareA={compare.a === session.id}
                  isCompareB={compare.b === session.id}
                  onOpen={() => openSession(session.id)}
                  onCompare={() => handleCompareToggle(session.id)}
                />
              ))}
            </View>
            {hasMoreMonthSessions ? (
              <Pressable
                onPress={() => router.push('/session/history')}
                style={{
                  marginTop: spacing.sm,
                  backgroundColor: colors.bg.elevated,
                  borderRadius: borderRadius.md,
                  borderWidth: 1,
                  borderColor: colors.border.primary,
                  paddingVertical: spacing.sm,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodySemiBold, color: colors.accent.primary }}>
                  Ver más
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>

      {/* 4. Compare sessions panel */}
      {compare.a != null || compare.b != null ? (
        <ComparePanel
          aId={compare.a}
          bId={compare.b}
          sessionA={compareResult?.a ?? null}
          sessionB={compareResult?.b ?? null}
          comparison={comparison}
          unit={unit}
          expanded={compareExpanded}
          onToggleExpanded={() => setCompareExpanded((value) => !value)}
          onClose={() => setCompare({ a: null, b: null })}
        />
      ) : null}

      {/* Ejercicios — most used as entry, then per-exercise progression */}
      <View style={cardStyle}>
        <SectionTitle>Ejercicios</SectionTitle>

        {/* Exercise selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable
              onPress={() => {
                setSelectedExerciseId(null);
                setSelectedWeek(null);
              }}
              style={{
                backgroundColor: selectedExerciseId === null ? colors.accent.primary : colors.bg.elevated,
                borderWidth: selectedExerciseId === null ? 0 : 1,
                borderColor: colors.border.primary,
                paddingHorizontal: spacing.sm + spacing.xs,
                paddingVertical: spacing.xs + 2,
                borderRadius: borderRadius.full,
                marginRight: spacing.sm,
              }}
            >
              <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodySemiBold, color: selectedExerciseId === null ? colors.bg.primary : colors.text.secondary }}>
                Todos
              </Text>
            </Pressable>
            {(selectorExercises).map((exercise) => (
              <Pressable
                key={exercise.exerciseId}
                onPress={() => {
                  setSelectedExerciseId(exercise.exerciseId);
                  setSelectedWeek(null);
                }}
                style={{
                  backgroundColor: selectedExerciseId === exercise.exerciseId ? colors.accent.primary : colors.bg.elevated,
                  borderWidth: selectedExerciseId === exercise.exerciseId ? 0 : 1,
                  borderColor: colors.border.primary,
                  paddingHorizontal: spacing.sm + spacing.xs,
                  paddingVertical: spacing.xs + 2,
                  borderRadius: borderRadius.full,
                  marginRight: spacing.sm,
                }}
              >
                <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodySemiBold, color: selectedExerciseId === exercise.exerciseId ? colors.bg.primary : colors.text.secondary }}>
                  {EXERCISE_NAMES_ES[exercise.name] || exercise.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {selectedExerciseId === null ? (
          <>
            <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodyMedium, color: colors.text.muted, marginBottom: spacing.sm }}>
              Los más usados — tocá uno para ver su progresión.
            </Text>
            {mostUsedLoading ? (
              <LoadingSpinner message="Cargando ejercicios…" />
            ) : !topUsedExercises || topUsedExercises.length === 0 ? (
              <Text style={{ fontSize: fontSizes.sm, color: colors.text.muted, textAlign: 'center', paddingVertical: spacing.md }}>
                Aún no hay ejercicios entrenados
              </Text>
            ) : (
              <View>
                {topUsedExercises.map((exercise, index) => (
                  <MostUsedExerciseRow
                    key={exercise.exerciseId}
                    name={EXERCISE_NAMES_ES[exercise.name] || exercise.name}
                    sessionCount={exercise.sessionCount}
                    setCount={exercise.setCount}
                    maxWeight={exercise.maxWeight}
                    unit={resolveUnit(exercise.unit, unit)}
                    isLast={index === topUsedExercises.length - 1}
                    onPress={() => {
                      setSelectedExerciseId(exercise.exerciseId);
                      setSelectedWeek(null);
                    }}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            {/* Date range */}
            <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodyMedium, color: colors.text.muted, marginBottom: spacing.sm }}>
              Rango de fechas
            </Text>
            <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
              {(['4weeks', '12weeks', 'all'] as DateRange[]).map((range) => (
                <Pressable
                  key={range}
                  onPress={() => {
                    setDateRange(range);
                    setSelectedWeek(null);
                  }}
                  style={{
                    backgroundColor: dateRange === range ? colors.accent.primary : colors.bg.elevated,
                    borderWidth: dateRange === range ? 0 : 1,
                    borderColor: colors.border.primary,
                    paddingHorizontal: spacing.sm + spacing.xs,
                    paddingVertical: spacing.xs + 2,
                    borderRadius: borderRadius.full,
                    marginRight: spacing.sm,
                  }}
                >
                  <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodySemiBold, color: dateRange === range ? colors.bg.primary : colors.text.secondary }}>
                    {range === '4weeks' ? '4 semanas' : range === '12weeks' ? '12 semanas' : 'Todo'}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Charts */}
            <View style={{ gap: spacing.sm }}>
              <ProgressChart
                embedded
                data={filteredVolumeData}
                title={`Volumen semanal (${exerciseUnit})`}
                unit={exerciseUnit}
                selectedWeek={selectedWeek}
                onBarPress={handleBarPress}
              />
              <ProgressChart
                embedded
                data={filteredSessionData}
                title="Sesiones por semana"
                selectedWeek={selectedWeek}
                onBarPress={handleBarPress}
              />
            </View>

            {selectedWeek ? (
              <View style={{ marginTop: spacing.md }}>
                <WeekDetailPanel
                  week={selectedWeek}
                  sessions={weeklySessions}
                  loading={weeklyLoading}
                  unit={unit}
                  onClose={() => setSelectedWeek(null)}
                  onOpenSession={openSession}
                />
              </View>
            ) : null}

            {/* Per-exercise progression */}
            <View style={{ marginTop: spacing.md }}>
              <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.sm }}>
                Evolución
              </Text>
              {evolutionLoading ? (
                <LoadingSpinner message="Cargando evolución…" />
              ) : !exerciseSessions || exerciseSessions.length === 0 ? (
                <Text style={{ fontSize: fontSizes.sm, color: colors.text.muted, textAlign: 'center', paddingVertical: spacing.md }}>
                  Sin registros de este ejercicio
                </Text>
              ) : (
                <View>
                  {exerciseSessions.map((entry, index) => (
                    <Pressable
                      key={entry.sessionId}
                      onPress={() => openSession(entry.sessionId)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.sm,
                        paddingVertical: spacing.sm + 2,
                        borderBottomWidth: index === exerciseSessions.length - 1 ? 0 : 1,
                        borderBottomColor: colors.border.divider,
                      }}
                    >
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
                          {formatDayShort(entry.startedAt)}
                        </Text>
                        <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.muted }}>
                          {entry.setCount} series · {entry.completedSets} completadas
                        </Text>
                      </View>
                      <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.bodySemiBold, color: colors.text.secondary }}>
                        {formatVolume(entry.volume, exerciseUnit)}
                      </Text>
                      <Text style={{ fontSize: 16, color: colors.text.muted }}>›</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}