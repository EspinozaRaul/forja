import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius, fontSizes , fontWeights, borderWidths} from '../lib/theme/tokens';

const RIR_OPTIONS = [0, 1, 2, 3, 4];

interface RirPickerProps {
  value: number | null | undefined;
  onChange: (rir: number | null) => void;
  /** Pixels of padding at the end so chips align with REPS column (not the check button) */
  endPadding?: number;
}

/**
 * Compact one-tap RIR selector: chips 0-4, tapping again clears.
 * Lives below the set row so it never crowds the reps/weight inputs.
 */
export function RirPicker({ value, onChange, endPadding = 0 }: RirPickerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>RIR</Text>
      <View style={[styles.chips, endPadding > 0 && { marginRight: endPadding }]}>
        {RIR_OPTIONS.map((rir) => {
          const selected = value === rir;
          return (
            <TouchableOpacity
              key={rir}
              onPress={() => onChange(selected ? null : rir)}
              style={[styles.chip, selected && styles.chipSelected]}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {rir}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs + spacing.xxs,
    marginLeft: 71,
  },
  label: {
    fontSize: fontSizes.xs2, fontWeight: fontWeights.bold,
    color: colors.text.muted,
    letterSpacing: 0.4,
    width: 24,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.xs,
    flex: 1,
  },
  chip: {
    minWidth: 30,
    height: 24,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bg.elevated,
    borderWidth: borderWidths.thin,
    borderColor: colors.border.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.accent.muted,
    borderColor: colors.accent.primary,
  },
  chipText: {
    fontSize: fontSizes.xs, fontWeight: fontWeights.bold,
    color: colors.text.secondary,
  },
  chipTextSelected: {
    color: colors.accent.primary,
  },
});