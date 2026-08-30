import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius } from '../lib/theme/tokens';

interface SetLoggerHeaderProps {
  unit: string;
  onUnitChange?: (unit: string) => void;
  hasPartial?: boolean;
}

export function SetLoggerHeader({ unit, onUnitChange, hasPartial = false }: SetLoggerHeaderProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.serieHeader}>{t('setLogger.serie')}</Text>
      <Text style={styles.anteriorHeader}>{t('setLogger.anterior')}</Text>
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
      <Text style={styles.repsHeader}>{t('setLogger.reps')}</Text>
      {hasPartial && (
        <Text style={styles.partialHeader}>R/P</Text>
      )}
      <View style={styles.intensitySpacer} />
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
    width: 38,
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
  partialHeader: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text.muted,
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  intensitySpacer: {
    width: 24,
  },
  checkHeader: {
    width: 28,
    marginLeft: spacing.xs,
  },
});
