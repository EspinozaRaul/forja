import { eq, isNull, or, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { routines, sessionExercises, sessions } from './schema';

/**
 * The active account's id, mirroring the authenticated Supabase user.
 *
 * The DB layer is a set of plain functions called from React Query hooks, so
 * threading `userId` through every signature would churn every call site for no
 * behavioural gain. Instead the id is mirrored here and every query reads it.
 *
 * The ONLY writer is the auth effect in `lib/hooks/useAuth.ts`: it sets the id as
 * soon as the Supabase session resolves and clears it on sign-out. The root
 * layout mounts that hook above every screen and gates rendering on its `loading`
 * flag, which the effect keeps true until the legacy backfill finishes — so no
 * query can run before the mirror is set.
 */
let currentUserId: string | null = null;
const listeners = new Set<() => void>();

export function getCurrentUserId(): string | null {
  return currentUserId;
}

export function setCurrentUserId(id: string | null): void {
  if (currentUserId === id) return;
  currentUserId = id;
  for (const listener of listeners) listener();
}

/** Subscribe to id changes. Backs `useCurrentUserId` (React `useSyncExternalStore`). */
export function subscribeCurrentUserId(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * WHERE fragment keeping only rows owned by the active account. With no active
 * account the comparison is never true — `user_id = NULL` matches nothing in
 * SQLite — so nothing leaks while unauthenticated.
 */
export function ownedByCurrentUser(column: AnyColumn): SQL {
  return eq(column, currentUserId);
}

/**
 * WHERE fragment for the shared exercise library: seeded rows (`user_id IS NULL`)
 * stay visible to every account, user-created rows only to their owner.
 */
export function visibleToCurrentUser(column: AnyColumn): SQL {
  return or(isNull(column), eq(column, currentUserId)) as SQL;
}

/** WHERE fragment: the referenced session belongs to the active account. */
export function sessionOwnedByCurrentUser(sessionIdColumn: AnyColumn): SQL {
  return sql`EXISTS (SELECT 1 FROM ${sessions} WHERE ${sessions.id} = ${sessionIdColumn} AND ${sessions.userId} = ${currentUserId})`;
}

/**
 * WHERE fragment for child rows of sessions (`session_exercises`, `sets`): the
 * referenced session_exercise — and the session that owns it — belong to the
 * active account. Child tables carry no `user_id`; ownership is inherited.
 */
export function sessionExerciseOwnedByCurrentUser(sessionExerciseIdColumn: AnyColumn): SQL {
  return sql`EXISTS (SELECT 1 FROM ${sessionExercises} WHERE ${sessionExercises.id} = ${sessionExerciseIdColumn} AND ${sessionOwnedByCurrentUser(sessionExercises.sessionId)})`;
}

/** WHERE fragment: the referenced routine belongs to the active account. */
export function routineOwnedByCurrentUser(routineIdColumn: AnyColumn): SQL {
  return sql`EXISTS (SELECT 1 FROM ${routines} WHERE ${routines.id} = ${routineIdColumn} AND ${routines.userId} = ${currentUserId})`;
}
