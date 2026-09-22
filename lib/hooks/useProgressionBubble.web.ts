// Web mock — returns empty progression data without Drizzle ORM queries
// This file is only used on web (Metro resolves .web.ts over .ts)

import { useQuery } from '@tanstack/react-query';
import { useCurrentUserId } from './useCurrentUser';
import type { ExerciseProgressionDataPoint } from '../db/queries';

const PROGRESSION_KEY = ['progression'];

export function useExerciseProgressionData(exerciseId: number | null) {
  const userId = useCurrentUserId();
  return useQuery<ExerciseProgressionDataPoint[]>({
    queryKey: [...PROGRESSION_KEY, exerciseId, userId],
    queryFn: async () => {
      return [];
    },
    enabled: exerciseId != null && !!userId,
    staleTime: 60_000,
    refetchOnMount: true,
  });
}
