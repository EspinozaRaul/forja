import { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  useSessionsByMonth,
  useSessionMonthIndex,
} from '../../lib/hooks/useProgress';
import { useSettings } from '../../lib/utils/settings';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { NavigationButton } from '../../components/progress/NavigationButton';
import { formatDuration, formatVolume } from '../../lib/utils/format';
import type { WeightUnit } from '../../lib/utils/weight-unit';
import { colors, spacing, borderRadius, fonts, fontSizes } from '../../lib/theme/tokens';
import { buildMonthGrid, monthLabel, addMonths } from '../../lib/progress';
import type { SessionByMonth } from '../../lib/progress';

// ─── Locale-aware date helpers ─────────────────────────
const FALLBACK_DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
const FALLBACK_MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const FALLBACK_WEEKDAY_HEADER = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function getDaysShort(locale: string): string[] {
  try {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.UTC(2024, 0, 7 + i));
      return fmt.format(d);
    });
  } catch {
    return FALLBACK_DAYS_SHORT;
  }
}

function getMonthsShort(locale: string): string[] {
  try {
    const fmt = new Intl.DateTimeFormat(locale, { month: 'short' });
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(2024, i, 1));
      return fmt.format(d);
    });
  } catch {
    return FALLBACK_MONTHS_SHORT;
  }
}

function getWeekdayHeader(locale: string): string[] {
  try {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.UTC(2024, 0, 8 + i));
      return fmt.format(d);
    });
  } catch {
    return FALLBACK_WEEKDAY_HEADER;
  }
}

function formatDayShort(date: Date | string, locale: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDay.getTime()) / 86400000);
  if (diffDays === 0) return '__TODAY__';
  if (diffDays === 1) return '__YESTERDAY__';
  const days = getDaysShort(locale);
  const months = getMonthsShort(locale);
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

function formatTotalTime(seconds: number): string {
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
  return formatDuration(seconds);
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

function DayLabel({ sentry, t, locale }: { sentry: string; t: (key: string) => string; locale: string }) {
  if (sentry === '__TODAY__') return <>{t('progress.today')}</>;
  if (sentry === '__YESTERDAY__') return <>{t('progress.yesterday')}</>;
  return <>{sentry}</>;
}

function SessionRow({
  session,
  unit,
  onOpen,
  locale,
  t,
}: {
  session: SessionByMonth;
  unit: WeightUnit;
  onOpen: () => void;
  locale: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <Pressable
      onPress={onOpen}
      style={{
        backgroundColor: colors.bg.elevated,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border.primary,
        padding: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
            <DayLabel sentry={formatDayShort(session.startedAt, locale)} t={t} locale={locale} />
          </Text>
          <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.muted }}>
            {t('progress.exerciseCount', { count: session.exerciseCount })}
            {session.duration != null ? ` · ${formatDuration(session.duration)}` : ''}
            {' · '}
            {formatVolume(session.totalVolume, unit)}
          </Text>
        </View>
        <Text style={{ fontSize: 18, color: colors.text.muted }}>{'>'}</Text>
      </View>
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
  locale,
  t,
}: {
  year: number;
  month: number;
  grid: (number | null)[];
  daysWithSessions: Set<number>;
  selectedDay: number | null;
  sessionCount: number;
  onDayPress: (day: number) => void;
  onMonthChange: (delta: number) => void;
  locale: string;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const cellWidth = `${100 / 7}%` as `${number}%`;
  const cell = {
    width: cellWidth,
    aspectRatio: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 3,
  };
  const weekdayHeader = getWeekdayHeader(locale);

  return (
    <View style={cardStyle}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <Pressable
          onPress={() => onMonthChange(-1)}
          hitSlop={10}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.md, backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.primary }}
        >
          <Text style={{ fontSize: 20, color: colors.text.secondary }}>{'<'}</Text>
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
            {monthLabel(year, month)}
          </Text>
          <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.muted, marginTop: 2 }}>
            {t('progress.trainingCount', { count: sessionCount })}
          </Text>
        </View>
        <Pressable
          onPress={() => onMonthChange(1)}
          hitSlop={10}
          style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.md, backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.primary }}
        >
          <Text style={{ fontSize: 20, color: colors.text.secondary }}>{'>'}</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', marginBottom: spacing.xs }}>
        {weekdayHeader.map((d, i) => (
          <Text key={`${d}-${i}`} style={{ width: cellWidth, textAlign: 'center', fontSize: fontSizes.xs, fontFamily: fonts.bodyMedium, color: colors.text.muted }}>
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

// ─── Main screen ───────────────────────────────────────
export default function ProgressScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const router = useRouter();
  const settings = useSettings();
  const unit = settings.data.weightUnit;

  const now = new Date();
  const [visibleYear, setVisibleYear] = useState(now.getFullYear());
  const [visibleMonth, setVisibleMonth] = useState(now.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [dayExpanded, setDayExpanded] = useState(false);

  const yearMonth = `${visibleYear}-${String(visibleMonth).padStart(2, '0')}`;

  const { data: monthIndex } = useSessionMonthIndex();
  const { data: monthSessions, isLoading: monthLoading } = useSessionsByMonth(yearMonth);

  const monthEntry = monthIndex?.find((m) => m.yearMonth === yearMonth);
  const grid = buildMonthGrid(visibleYear, visibleMonth);
  const daysWithSessions = useMemo(() => new Set((monthSessions ?? []).map((s) => s.startedAt.getDate())), [monthSessions]);
  const selectedDaySessions =
    selectedDay != null ? (monthSessions ?? []).filter((s) => s.startedAt.getDate() === selectedDay) : [];

  const visibleDaySessions = dayExpanded ? selectedDaySessions : selectedDaySessions.slice(0, 3);
  const hasMoreDaySessions = selectedDaySessions.length > 3;

  const monthSessionsDesc = useMemo(() => [...(monthSessions ?? [])].sort(
    (a, b) => b.startedAt.getTime() - a.startedAt.getTime()
  ), [monthSessions]);
  const recentMonthSessions = monthSessionsDesc.slice(0, 4);
  const hasMoreMonthSessions = monthSessionsDesc.length > 4;

  const handleMonthChange = (delta: number) => {
    const next = addMonths(visibleYear, visibleMonth, delta);
    setVisibleYear(next.year);
    setVisibleMonth(next.month);
    setSelectedDay(null);
    setDayExpanded(false);
  };

  const openSession = (id: number) => router.push(`/session/history/${id}`);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg.primary }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl }}
    >
      {/* Calendar of trained days */}
      <CalendarCard
        year={visibleYear}
        month={visibleMonth}
        grid={grid}
        daysWithSessions={daysWithSessions}
        selectedDay={selectedDay}
        sessionCount={monthEntry?.sessionCount ?? monthSessions?.length ?? 0}
        onDayPress={setSelectedDay}
        onMonthChange={handleMonthChange}
        locale={locale}
        t={t}
      />

      {/* Selected day sessions */}
      {selectedDay != null ? (
        <View style={cardStyle}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
            <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
              {t('progress.daySessionsTitle', { day: selectedDay })}
            </Text>
            <Pressable onPress={() => setSelectedDay(null)} hitSlop={8}>
              <Text style={{ fontSize: fontSizes.sm, color: colors.accent.primary }}>{t('progress.viewAllMonth')}</Text>
            </Pressable>
          </View>
          {monthLoading ? (
            <LoadingSpinner message={t('progress.loading')} />
          ) : selectedDaySessions.length === 0 ? (
            <Text style={{ fontSize: fontSizes.sm, color: colors.text.muted, textAlign: 'center', paddingVertical: spacing.md }}>
              {t('progress.noSessionsDay')}
            </Text>
          ) : (
            <>
              <View style={{ gap: spacing.sm }}>
                {visibleDaySessions.map((session) => (
                  <SessionRow
                    key={session.id}
                    session={session}
                    unit={unit}
                    onOpen={() => openSession(session.id)}
                    locale={locale}
                    t={t}
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
                    {dayExpanded ? t('progress.viewLess') : t('progress.viewMoreCount', { count: selectedDaySessions.length })}
                  </Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {/* Sessions of the visible month */}
      <View style={cardStyle}>
        <SectionTitle>{t('progress.monthSessionsTitle')}</SectionTitle>
        {monthLoading ? (
          <LoadingSpinner message={t('progress.loadingSessions')} />
        ) : !monthSessions || monthSessions.length === 0 ? (
          <EmptyState
            title={t('progress.noSessionsMonth')}
            message={t('progress.noSessionsMonthMessage')}
          />
        ) : (
          <>
            <View style={{ gap: spacing.sm }}>
              {recentMonthSessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  unit={unit}
                  onOpen={() => openSession(session.id)}
                  locale={locale}
                  t={t}
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
                  {t('progress.viewMore')}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>

      {/* Navigation buttons */}
      <View style={{ gap: spacing.sm }}>
        <NavigationButton
          icon="bar-chart"
          label={t('progress.nav.statistics')}
          description={t('progress.nav.statisticsDescription')}
          onPress={() => router.push('/progress/statistics')}
        />
        <NavigationButton
          icon="body"
          label={t('progress.nav.measurements')}
          description={t('progress.nav.measurementsDescription')}
          onPress={() => router.push('/progress/measurements')}
        />
        <NavigationButton
          icon="barbell"
          label={t('progress.nav.exercises')}
          description={t('progress.nav.exercisesDescription')}
          onPress={() => router.push('/progress/exercises')}
        />
        <NavigationButton
          icon="git-compare"
          label={t('progress.nav.compare')}
          description={t('progress.nav.compareDescription')}
          onPress={() => router.push('/progress/routine-compare')}
        />
      </View>
    </ScrollView>
  );
}