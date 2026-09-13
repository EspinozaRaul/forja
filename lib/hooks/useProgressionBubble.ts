import { useQuery } from '@tanstack/react-query';
import { getExerciseProgressionData } from '../db/queries';
import { useCurrentUserId } from './useCurrentUser';
import type { ExerciseProgressionDataPoint } from '../db/queries';

const PROGRESSION_KEY = ['progression'];

export function useExerciseProgressionData(exerciseId: number | null) {
  const userId = useCurrentUserId();
  return useQuery<ExerciseProgressionDataPoint[]>({
    queryKey: [...PROGRESSION_KEY, exerciseId, userId],
    queryFn: () => getExerciseProgressionData(exerciseId!),
    enabled: exerciseId != null && !!userId,
    staleTime: 60_000,
    refetchOnMount: true,
  });
}
