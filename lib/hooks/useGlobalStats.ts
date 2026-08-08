import { useQuery } from '@tanstack/react-query';
import { getGlobalStats } from '../db/queries';
import type { GlobalStats } from '../db/queries';

export function useGlobalStats() {
  return useQuery<GlobalStats>({
    queryKey: ['globalStats'],
    queryFn: getGlobalStats,
  });
}
