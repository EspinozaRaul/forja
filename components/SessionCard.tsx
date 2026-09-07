import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts, fontSizes } from '../lib/theme/tokens';
import type { Session } from '../lib/types';
import { formatRelativeDate } from '../lib/utils/format';

interface SessionCardProps {
  session: Session;
  exerciseCount?: number;
  routineName?: string;
}

export function SessionCard({ session, exerciseCount, routineName }: SessionCardProps) {
  const { t } = useTranslation();
  const dateStr = formatRelativeDate(session.startedAt, t);
  const displayName = routineName || t('tabs.home.quickRoutine');

  return (
    <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
        <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary }} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.bodyMedium, color: colors.text.muted }}>
          {dateStr}
        </Text>
      </View>

      {exerciseCount !== undefined && (
        <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.body, color: colors.text.muted }}>
          {t('session.exerciseCount', { count: exerciseCount })}
        </Text>
      )}

      {session.notes && (
        <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.body, color: colors.text.muted, marginTop: spacing.sm }} numberOfLines={2}>
          {session.notes}
        </Text>
      )}
    </View>
  );
}
