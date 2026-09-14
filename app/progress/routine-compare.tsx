import { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts, fontSizes, borderWidths } from '../../lib/theme/tokens';
import { getAllRoutines } from '../../lib/db/queries';
import { useRoutineCompare } from '../../lib/hooks/useProgress';
import { PeriodChips } from '../../components/progress/PeriodChips';
import { RoutinePickerModal } from '../../components/progress/RoutinePickerModal';
import { RoutineCompareTable } from '../../components/progress/RoutineCompareTable';
import { EmptyState } from '../../components/ui/EmptyState';
import { QueryState } from '../../components/ui/QueryState';
import { Screen } from '../../components/ui/Screen';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useQuery } from '@tanstack/react-query';

// ─── Helpers ──────────────────────────────────────────

/** Generate the last N period keys (YYYY-MM) ending at the current month. */
function generatePeriodKeys(count: number): string[] {
  const now = new Date();
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    keys.push(`${y}-${m}`);
  }
  return keys;
}

/** Build a map of periodKey -> unique session date strings for column headers. */
function buildPeriodDates(
  data: import('../../lib/progress').RoutineComparisonData
): { [periodKey: string]: string[] } {
  const result: { [periodKey: string]: string[] } = {};
  for (const period of data.periods) {
    const dates = new Set<string>();
    for (const exercise of data.exercises) {
      const pd = exercise.periods[period.periodKey];
      if (pd) {
        for (const s of pd.sessions) {
          dates.add(s.date);
        }
      }
    }
    result[period.periodKey] = Array.from(dates).sort();
  }
  return result;
}

// ─── Screen ───────────────────────────────────────────

export default function RoutineCompareScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [selectedRoutineId, setSelectedRoutineId] = useState<number | null>(null);
  const [selectedRoutineName, setSelectedRoutineName] = useState('');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([]);

  // Available periods: last 6 months
  const availablePeriods = useMemo(() => generatePeriodKeys(6), []);

  // Default: select last 2 months
  useMemo(() => {
    if (selectedPeriods.length === 0 && availablePeriods.length >= 2) {
      setSelectedPeriods(availablePeriods.slice(-2));
    }
  }, [availablePeriods]);

  // Fetch routines list for picker
  const { data: routines = [] } = useQuery({
    queryKey: ['routines', 'list'],
    queryFn: async () => {
      const all = await getAllRoutines();
      return all.map((r) => ({
        id: r.id,
        name: r.name,
        sessionCount: 0,
      }));
    },
  });

  const routineOptions = useMemo(() => routines, [routines]);
  
  // Month labels for translation
  const monthLabels = useMemo(() => [
    t('progress.months.jan'), t('progress.months.feb'), t('progress.months.mar'),
    t('progress.months.apr'), t('progress.months.may'), t('progress.months.jun'),
    t('progress.months.jul'), t('progress.months.aug'), t('progress.months.sep'),
    t('progress.months.oct'), t('progress.months.nov'), t('progress.months.dec'),
  ], [t]);

  // Comparison data
  const compareQuery = useRoutineCompare(
    selectedRoutineId,
    selectedRoutineName,
    selectedPeriods,
    monthLabels
  );
  const comparisonData = compareQuery.data;

  const periodDates = useMemo(
    () => (comparisonData ? buildPeriodDates(comparisonData) : {}),
    [comparisonData]
  );

  const handleSelectRoutine = useCallback((id: number) => {
    const routine = routines.find((r) => r.id === id);
    setSelectedRoutineId(id);
    setSelectedRoutineName(routine?.name ?? '');
  }, [routines]);

  return (
  <Screen>
      <ScreenHeader
        title={selectedRoutineName || t('progress.routineCompare.title')}
        onBack={() => router.back()}
        divider
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl }}
      >
        {/* Routine picker trigger */}
        <Pressable
          onPress={() => setPickerVisible(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            backgroundColor: colors.bg.card,
            borderRadius: borderRadius.lg,
            borderWidth: borderWidths.thin,
            borderColor: colors.border.primary,
            padding: spacing.md,
          }}
        >
          <Ionicons name="swap-horizontal" size={20} color={colors.accent.primary} />
          <Text
            style={{
              flex: 1,
              fontSize: fontSizes.sm,
              fontFamily: fonts.bodySemiBold,
              color: selectedRoutineId ? colors.text.primary : colors.text.muted,
            }}
          >
            {selectedRoutineName || t('progress.routineCompare.selectRoutine')}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
        </Pressable>

        {/* Period chips */}
        {selectedRoutineId ? (
          <View>
            <Text
              style={{
                fontSize: fontSizes.xs,
                fontFamily: fonts.bodyMedium,
                color: colors.text.muted,
                marginBottom: spacing.sm,
              }}
            >
              Selecciona los meses a comparar (max 6)
            </Text>
            <PeriodChips
              periods={availablePeriods}
              selected={selectedPeriods}
              onChange={setSelectedPeriods}
              maxSelect={6}
            />
          </View>
        ) : null}

        {/* Comparison table */}
        {selectedRoutineId && selectedPeriods.length >= 2 ? (
          <QueryState
            queries={[compareQuery]}
            loadingMessage={t('progress.routineCompare.loading')}
          >
            {comparisonData ? (
              <RoutineCompareTable data={comparisonData} periodDates={periodDates} />
            ) : null}
          </QueryState>
        ) : selectedRoutineId ? (
          <View
            style={{
              backgroundColor: colors.bg.card,
              borderRadius: borderRadius.lg,
              borderWidth: borderWidths.thin,
              borderColor: colors.border.primary,
              padding: spacing.lg,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontSize: fontSizes.sm,
                color: colors.text.muted,
                textAlign: 'center',
              }}
              >
                {t('progress.routineCompare.selectPeriods')}
              </Text>
          </View>
        ) : (
          <EmptyState
            title={t('progress.routineCompare.selectRoutineTitle')}
            message={t('progress.routineCompare.selectRoutineMessage')}
          />
        )}
      </ScrollView>

      {/* Routine picker modal */}
      <RoutinePickerModal
        visible={pickerVisible}
        routines={routineOptions}
        onSelect={handleSelectRoutine}
        onClose={() => setPickerVisible(false)}
      />
    </Screen>
  );
}
