import { View, Text } from 'react-native';
import { colors, spacing, borderRadius, fonts } from '../lib/theme/tokens';
import type { Session } from '../lib/types';
import { formatRelativeDate } from '../lib/utils/format';

interface SessionCardProps {
  session: Session;
  exerciseCount?: number;
}

function formatDurationDisplay(seconds: number | null): string {
  if (seconds === null) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

export function SessionCard({ session, exerciseCount }: SessionCardProps) {
  return (
    <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md }} className="bg-dark-card rounded-2xl p-4">
      <View className="flex-row items-center justify-between mb-2">
        <Text style={{ fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.text.primary }} className="text-base font-semibold text-white">
          {formatRelativeDate(session.startedAt)}
        </Text>
        <Text style={{ fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.text.secondary }} className="text-sm font-medium text-dark-text-secondary">
          {formatDurationDisplay(session.duration)}
        </Text>
      </View>

      {exerciseCount !== undefined && (
        <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.muted }} className="text-sm text-dark-text-muted">
          {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
        </Text>
      )}

      {session.notes && (
        <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.muted, marginTop: spacing.sm }} className="text-sm text-dark-text-muted mt-2" numberOfLines={2}>
          {session.notes}
        </Text>
      )}
    </View>
  );
}
