import { useQuery } from '@tanstack/react-query';
import { getGlobalStats } from '../db/queries';
import { useCurrentUserId } from './useCurrentUser';
import type { GlobalStats } from '../db/queries';

export function useGlobalStats() {
  const userId = useCurrentUserId();
  return useQuery<GlobalStats>({
    queryKey: ['globalStats', userId],
    queryFn: getGlobalStats,
    enabled: !!userId,
  });
}
