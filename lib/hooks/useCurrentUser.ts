import { useSyncExternalStore } from 'react';
import { getCurrentUserId, subscribeCurrentUserId } from '../db/user-scope';

/**
 * The active account id, mirroring the DB layer's user scope. Query hooks read
 * it to make every user-owned cache key per-account; because it is an external
 * store, components re-render when it changes (sign-in / sign-out).
 */
export function useCurrentUserId(): string | null {
  return useSyncExternalStore(subscribeCurrentUserId, getCurrentUserId, getCurrentUserId);
}
