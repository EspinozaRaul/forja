import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts } from '../lib/theme/tokens';
import type { Session } from '../lib/types';
import { formatRelativeDate } from '../lib/utils/format';

interface SessionCardProps {
  session: Session;
  exerciseCount?: number;
  routineName?: string;
}

function formatDurationDisplay(seconds: number | null): string {
  if (seconds === null) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function SessionCard({ session, exerciseCount, routineName }: SessionCardProps) {
  const { t } = useTranslation();
  const dateStr = formatRelativeDate(session.startedAt, t);
  const displayName = routineName || t('tabs.home.quickRoutine');

  return (
    <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
        <Text style={{ fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.text.primary }} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={{ fontSize: 12, fontFamily: fonts.bodyMedium, color: colors.text.muted }}>
          {dateStr}
        </Text>
      </View>

      {exerciseCount !== undefined && (
        <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.muted }}>
          {exerciseCount} ejercicio{exerciseCount !== 1 ? 's' : ''}
        </Text>
      )}

      {session.notes && (
        <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.muted, marginTop: spacing.sm }} numberOfLines={2}>
          {session.notes}
        </Text>
      )}
    </View>
  );
}
