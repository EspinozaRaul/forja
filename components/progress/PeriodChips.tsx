import { ScrollView, Pressable, Text, View } from 'react-native';
import { colors, spacing, borderRadius, fonts, fontSizes } from '../../lib/theme/tokens';

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
function formatPeriodLabel(periodKey: string): string {
  const [year, month] = periodKey.split('-');
  const idx = parseInt(month, 10) - 1;
  const LABELS = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
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
              paddingVertical: spacing.xs + 2,
              borderRadius: borderRadius.full,
              backgroundColor: isSelected ? colors.accent.primary : 'transparent',
              borderWidth: 1,
              borderColor: isSelected ? colors.accent.primary : colors.border.primary,
            }}
          >
            <Text
              style={{
                fontSize: fontSizes.xs,
                fontFamily: fonts.bodyMedium,
                color: isSelected ? colors.bg.primary : colors.text.secondary,
              }}
            >
              {formatPeriodLabel(periodKey)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
