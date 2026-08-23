import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '../lib/theme/tokens';

const RIR_OPTIONS = [0, 1, 2, 3, 4];

interface RirPickerProps {
  value: number | null | undefined;
  onChange: (rir: number | null) => void;
}

/**
 * Compact one-tap RIR selector: chips 0-4, tapping again clears.
 * Lives below the set row so it never crowds the reps/weight inputs.
 */
export function RirPicker({ value, onChange }: RirPickerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>RIR</Text>
      <View style={styles.chips}>
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
      <Text style={styles.hint}>{value == null ? '—' : value === 0 ? 'fallo' : value === 1 ? '1 en reserva' : `${value} en reserva`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs + 2,
    paddingLeft: 36,
    paddingRight: spacing.sm,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.4,
    width: 24,
  },
  chips: {
    flexDirection: 'row',
    gap: spacing.xs,
    flex: 1,
    justifyContent: 'flex-start',
  },
  chip: {
    minWidth: 30,
    height: 24,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1,
    borderColor: colors.border.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  chipSelected: {
    backgroundColor: colors.accent.muted,
    borderColor: colors.accent.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  chipTextSelected: {
    color: colors.accent.primary,
  },
  hint: {
    fontSize: 10,
    color: colors.text.muted,
    marginLeft: spacing.xs,
  },
});