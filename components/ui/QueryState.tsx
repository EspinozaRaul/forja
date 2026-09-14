import { type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { EmptyState } from './EmptyState';
import { LoadingSpinner } from './LoadingSpinner';
import { Button } from './Button';
import { colors } from '../../lib/theme/tokens';

/**
 * The shape a react-query result must expose for `QueryState` to branch on it.
 * Every `useQuery`/custom hook in the app already returns this (plus `data`),
 * so a screen can pass the query object itself instead of re-deriving booleans.
 */
export interface QueryLike {
  isLoading: boolean;
  isError: boolean;
  /** Optional: used only to show a spinner on the retry button mid-refetch. */
  isFetching?: boolean;
  refetch: () => unknown;
}

interface QueryStateProps {
  /**
   * Every query the visible content depends on. Any single one in an error
   * state shows the failure branch — this is what keeps a multi-query screen
   * (six reads behind one spinner) from leaking a half-loaded screen.
   */
  queries: QueryLike[];
  /** Spinner message while any query is loading. */
  loadingMessage?: string;
  /** When true, render the empty branch instead of `children`. */
  empty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyIcon?: ReactNode | keyof typeof Ionicons.glyphMap;
  /** Failure copy overrides; default to a generic "could not load" message. */
  errorTitle?: string;
  errorMessage?: string;
  children: ReactNode;
}

/**
 * Renders the loading / failure / empty branches for query-backed content.
 *
 * Why it exists: a screen that only checks `!data` cannot tell a FAILED request
 * from empty data or a wrong id, so a dropped connection reads as "not found"
 * and the user concludes their training data is gone. By routing the three
 * states through one component, a screen cannot forget the failure case — the
 * retry action is part of the primitive, not a convention to remember.
 *
 * Precedence: loading → failure → empty → children. The failure branch stays
 * visible while a retry is in flight (only the button goes busy) so the user
 * always has the action in reach.
 */
export function QueryState({
  queries,
  loadingMessage,
  empty = false,
  emptyTitle,
  emptyMessage,
  emptyIcon,
  errorTitle,
  errorMessage,
  children,
}: QueryStateProps) {
  const { t } = useTranslation();

  const isLoading = queries.some((query) => query.isLoading);
  const isError = queries.some((query) => query.isError);
  const isRetrying = isError && queries.some((query) => query.isFetching);

  if (isLoading) {
    return <LoadingSpinner message={loadingMessage} />;
  }

  if (isError) {
    return (
      <EmptyState
        icon={<Ionicons name="cloud-offline-outline" size={48} color={colors.error} />}
        title={errorTitle ?? t('common.queryError.title')}
        message={errorMessage ?? t('common.queryError.message')}
        action={
          <Button
            title={t('common.retry')}
            variant="secondary"
            loading={isRetrying}
            disabled={isRetrying}
            onPress={() => {
              for (const query of queries) {
                if (query.isError) query.refetch();
              }
            }}
          />
        }
      />
    );
  }

  if (empty) {
    return <EmptyState icon={emptyIcon} title={emptyTitle ?? ''} message={emptyMessage} />;
  }

  return <>{children}</>;
}
