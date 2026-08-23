import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fonts } from '../lib/theme/tokens';

interface SetLoggerHeaderProps {
  unit: string;
  onUnitChange?: (unit: string) => void;
}

export function SetLoggerHeader({ unit, onUnitChange }: SetLoggerHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.serieHeader}>SERIE</Text>
      <Text style={styles.anteriorHeader}>ANTERIOR</Text>
      <TouchableOpacity
        onPress={() => onUnitChange?.(unit === 'kg' ? 'lbs' : 'kg')}
        style={styles.unitHeader}
        disabled={!onUnitChange}
      >
        <Text style={styles.unitHeaderText}>{unit.toUpperCase()}</Text>
        {onUnitChange && (
          <Ionicons name="swap-vertical" size={10} color={colors.text.muted} />
        )}
      </TouchableOpacity>
      <Text style={styles.repsHeader}>REPS</Text>
      <View style={styles.checkHeader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.divider,
    marginBottom: spacing.xs,
  },
  serieHeader: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text.muted,
    width: 28,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  anteriorHeader: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text.muted,
    width: 65,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  unitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flex: 1,
    justifyContent: 'center',
  },
  unitHeaderText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text.muted,
    letterSpacing: 0.5,
  },
  repsHeader: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text.muted,
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  checkHeader: {
    width: 28,
  },
});
