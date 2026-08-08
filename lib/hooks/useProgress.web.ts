// Web mock — returns sample progress data without Drizzle ORM queries
// This file is only used on web (Metro resolves .web.ts over .ts)

import { useQuery } from '@tanstack/react-query';
import type { ProgressDataPoint, WeeklyVolume } from '../types';

const PROGRESS_KEY = ['progress'];

export function useExerciseProgress(exerciseId: number, startDate?: Date, endDate?: Date) {
  return useQuery<WeeklyVolume[]>({
    queryKey: [...PROGRESS_KEY, 'exercise', exerciseId, startDate, endDate],
    queryFn: async () => {
      if (!exerciseId) return [];
      // Return sample weekly volume data
      return [
        { week: '2026-W28', exerciseId, exerciseName: '', totalVolume: 2400 },
        { week: '2026-W27', exerciseId, exerciseName: '', totalVolume: 2100 },
        { week: '2026-W26', exerciseId, exerciseName: '', totalVolume: 1800 },
      ];
    },
    enabled: !!exerciseId,
  });
}

export function useSessionCountByWeek(exerciseId?: number) {
  return useQuery<ProgressDataPoint[]>({
    queryKey: [...PROGRESS_KEY, 'sessionCount', exerciseId],
    queryFn: async () => {
      return [
        { date: '2026-W28', value: 3 },
        { date: '2026-W27', value: 2 },
        { date: '2026-W26', value: 4 },
        { date: '2026-W25', value: 1 },
      ];
    },
  });
}

export function useTotalVolumeByWeek(exerciseId: number) {
  return useQuery<ProgressDataPoint[]>({
    queryKey: [...PROGRESS_KEY, 'totalVolume', exerciseId],
    queryFn: async () => {
      if (!exerciseId) return [];
      return [
        { date: '2026-W28', value: 4800 },
        { date: '2026-W27', value: 3600 },
        { date: '2026-W26', value: 5200 },
      ];
    },
    enabled: !!exerciseId,
  });
}
