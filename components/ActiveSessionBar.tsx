import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, fontSizes, fonts } from '../lib/theme/tokens';

interface ActiveSessionBarProps {
  session: {
    id: number;
    startedAt: Date | string;
    routineId: number | null;
  };
  routineName: string | null;
  onResume: () => void;
  onDiscard: () => void;
}

export function ActiveSessionBar({
  session,
  routineName,
  onResume,
  onDiscard,
}: ActiveSessionBarProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        <Text style={styles.label} numberOfLines={1}>
          {routineName ?? t('session.activeBar.active')}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity onPress={onResume} style={styles.resumeBtn}>
            <Ionicons name="arrow-forward" size={13} color={colors.bg.primary} />
            <Text style={styles.resumeText}>{t('session.activeBar.resume')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDiscard} style={styles.discardBtn}>
            <Text style={styles.discardText}>{t('session.activeBar.discard')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.card,
    borderTopWidth: 1,
    borderTopColor: colors.border.primary,
  },
  bar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSizes.md,
    fontFamily: fonts.bodySemiBold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  resumeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent.primary,
    paddingVertical: spacing.sm + spacing.xs,
    gap: spacing.xs,
  },
  resumeText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.bodySemiBold,
    color: colors.bg.primary,
  },
  discardBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    paddingVertical: spacing.sm + spacing.xs,
  },
  discardText: {
    fontSize: fontSizes.sm,
    fontFamily: fonts.bodySemiBold,
    color: colors.text.primary,
  },
});
