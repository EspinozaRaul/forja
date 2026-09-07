import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, fontSizes , fontWeights} from '../lib/theme/tokens';
import { SET_LOGGER } from '../lib/constants/layout';

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
    fontSize: fontSizes.xxs, fontWeight: fontWeights.bold,
    color: colors.text.muted,
    width: SET_LOGGER.SERIE_WIDTH,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  anteriorHeader: {
    fontSize: fontSizes.xxs, fontWeight: fontWeights.bold,
    color: colors.text.muted,
    width: SET_LOGGER.PREVIOUS_WIDTH,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  unitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    flex: 1,
    justifyContent: 'center',
  },
  unitHeaderText: {
    fontSize: fontSizes.xxs, fontWeight: fontWeights.bold,
    color: colors.text.muted,
    letterSpacing: 0.5,
  },
  repsHeader: {
    fontSize: fontSizes.xxs, fontWeight: fontWeights.bold,
    color: colors.text.muted,
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  partialHeader: {
    fontSize: fontSizes.xxs, fontWeight: fontWeights.bold,
    color: colors.text.muted,
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  intensitySpacer: {
    width: SET_LOGGER.CHECK_SIZE,
  },
  checkHeader: {
    width: SET_LOGGER.CHECK_SIZE,
    marginLeft: spacing.xs,
  },
});
