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
    <View className="bg-white rounded-lg p-4 shadow-sm">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-base font-semibold text-gray-900">
          {formatRelativeDate(session.startedAt)}
        </Text>
        <Text className="text-sm text-gray-500">
          {formatDurationDisplay(session.duration)}
        </Text>
      </View>

      {exerciseCount !== undefined && (
        <Text className="text-sm text-gray-500">
          {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
        </Text>
      )}

      {session.notes && (
        <Text className="text-sm text-gray-400 mt-1" numberOfLines={2}>
          {session.notes}
        </Text>
      )}
    </View>
  );
}
