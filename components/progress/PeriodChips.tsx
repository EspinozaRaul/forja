import { ScrollView, Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts, fontSizes, borderWidths } from '../../lib/theme/tokens';

interface PeriodChipsProps {
  /** Available period keys (e.g. ["2026-01", "2026-02"]). */
  periods: string[];
  /** Currently selected period keys. */
  selected: string[];
  /** Called when selection changes. */
  onChange: (selected: string[]) => void;
  /** Max selectable months. Defaults to 6. */
  maxSelect?: number;
}

/** Format a "YYYY-MM" period key into a short Spanish label like "Ene 2026". */
function formatPeriodLabel(periodKey: string, t: (key: string) => string): string {
  const [year, month] = periodKey.split('-');
  const idx = parseInt(month, 10) - 1;
  const LABELS = [
    t('progress.months.jan'), t('progress.months.feb'), t('progress.months.mar'),
    t('progress.months.apr'), t('progress.months.may'), t('progress.months.jun'),
    t('progress.months.jul'), t('progress.months.aug'), t('progress.months.sep'),
    t('progress.months.oct'), t('progress.months.nov'), t('progress.months.dec'),
  ];
  return `${LABELS[idx] ?? month} ${year}`;
}

/**
 * Horizontal scrollable month chip selector.
 * 2-6 months max. Spanish labels via Intl.DateTimeFormat or fallback.
 */
export function PeriodChips({
  periods,
  selected,
  onChange,
  maxSelect = 6,
}: PeriodChipsProps) {
  const { t } = useTranslation();
  
  const toggle = (key: string) => {
    if (selected.includes(key)) {
      onChange(selected.filter((k) => k !== key));
    } else if (selected.length < maxSelect) {
      onChange([...selected, key]);
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm }}
    >
      {periods.map((periodKey) => {
        const isSelected = selected.includes(periodKey);
        return (
          <Pressable
            key={periodKey}
            onPress={() => toggle(periodKey)}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs + spacing.xxs,
              borderRadius: borderRadius.full,
              backgroundColor: isSelected ? colors.accent.primary : 'transparent',
              borderWidth: borderWidths.thin,
              borderColor: isSelected ? colors.accent.primary : colors.border.primary,
            }}
            accessibilityLabel={`Período: ${formatPeriodLabel(periodKey, t)}`}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              style={{
                fontSize: fontSizes.xs,
                fontFamily: fonts.bodyMedium,
                color: isSelected ? colors.bg.primary : colors.text.secondary,
              }}
            >
              {formatPeriodLabel(periodKey, t)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
