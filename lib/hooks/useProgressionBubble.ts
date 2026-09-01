import { useQuery } from '@tanstack/react-query';
import { getExerciseProgressionData } from '../db/queries';
import type { ExerciseProgressionDataPoint } from '../db/queries';

const PROGRESSION_KEY = ['progression'];

export function useExerciseProgressionData(exerciseId: number | null) {
  return useQuery<ExerciseProgressionDataPoint[]>({
    queryKey: [...PROGRESSION_KEY, exerciseId],
    queryFn: () => getExerciseProgressionData(exerciseId!),
    enabled: exerciseId != null,
    staleTime: 60_000,
    refetchOnMount: true,
  });
}
