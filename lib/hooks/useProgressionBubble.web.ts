// Web mock — returns empty progression data without Drizzle ORM queries
// This file is only used on web (Metro resolves .web.ts over .ts)

import { useQuery } from '@tanstack/react-query';
import type { ExerciseProgressionDataPoint } from '../db/queries';

const PROGRESSION_KEY = ['progression'];

export function useExerciseProgressionData(exerciseId: number | null) {
  return useQuery<ExerciseProgressionDataPoint[]>({
    queryKey: [...PROGRESSION_KEY, exerciseId],
    queryFn: async () => {
      return [];
    },
    enabled: exerciseId != null,
    staleTime: 60_000,
  });
}
