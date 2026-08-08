import { View, Text } from 'react-native';
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
    <View style={{ backgroundColor: '#1A1A1A', borderRadius: 16, padding: 16 }} className="bg-dark-card rounded-2xl p-4">
      <View className="flex-row items-center justify-between mb-2">
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#FFFFFF' }} className="text-base font-semibold text-white">
          {formatRelativeDate(session.startedAt)}
        </Text>
        <Text style={{ fontSize: 14, fontWeight: '500', color: '#A0A0A0' }} className="text-sm font-medium text-dark-text-secondary">
          {formatDurationDisplay(session.duration)}
        </Text>
      </View>

      {exerciseCount !== undefined && (
        <Text style={{ fontSize: 14, color: '#666666' }} className="text-sm text-dark-text-muted">
          {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
        </Text>
      )}

      {session.notes && (
        <Text style={{ fontSize: 14, color: '#666666', marginTop: 8 }} className="text-sm text-dark-text-muted mt-2" numberOfLines={2}>
          {session.notes}
        </Text>
      )}
    </View>
  );
}
