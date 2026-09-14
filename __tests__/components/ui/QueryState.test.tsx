import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import i18n from '../../../lib/i18n';
import { QueryState, type QueryLike } from '../../../components/ui/QueryState';

/**
 * These exercise the REAL `QueryState` — no mock of the component under test.
 * `render`/`fireEvent` from `@testing-library/react-native` (backed by the
 * `test-renderer` peer) are what make the failure path observable at all.
 * In RNTL 14 both are async, so every interaction is awaited.
 */

function makeQuery(overrides: Partial<QueryLike> = {}): QueryLike {
  return {
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: jest.fn(),
    ...overrides,
  };
}

describe('QueryState', () => {
  it('renders the failure state with a retry action when a query errors', async () => {
    await render(
      <QueryState queries={[makeQuery({ isError: true })]}>
        <Text>CONTENT</Text>
      </QueryState>
    );

    expect(screen.getByText(i18n.t('common.queryError.title'))).toBeTruthy();
    expect(screen.getByRole('button', { name: i18n.t('common.retry') })).toBeTruthy();
  });

  it('calls refetch on the failed query when retry is pressed', async () => {
    const refetch = jest.fn();
    await render(
      <QueryState queries={[makeQuery({ isError: true, refetch })]}>
        <Text>CONTENT</Text>
      </QueryState>
    );

    await fireEvent.press(screen.getByRole('button', { name: i18n.t('common.retry') }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('retries only the queries that failed (multi-query screen)', async () => {
    const healthyRefetch = jest.fn();
    const failedRefetch = jest.fn();
    await render(
      <QueryState
        queries={[
          makeQuery({ refetch: healthyRefetch }),
          makeQuery({ isError: true, refetch: failedRefetch }),
        ]}
      >
        <Text>CONTENT</Text>
      </QueryState>
    );

    await fireEvent.press(screen.getByRole('button', { name: i18n.t('common.retry') }));
    expect(failedRefetch).toHaveBeenCalledTimes(1);
    expect(healthyRefetch).not.toHaveBeenCalled();
  });

  it('prefers the failure state over the empty state when a query errored', async () => {
    await render(
      <QueryState queries={[makeQuery({ isError: true })]} empty emptyTitle="NO DATA">
        <Text>CONTENT</Text>
      </QueryState>
    );

    expect(screen.getByText(i18n.t('common.queryError.title'))).toBeTruthy();
    expect(screen.queryByText('NO DATA')).toBeNull();
  });

  it('renders the empty state when the query resolved with no data', async () => {
    await render(
      <QueryState queries={[makeQuery()]} empty emptyTitle="NO DATA" emptyMessage="NOTHING HERE">
        <Text>CONTENT</Text>
      </QueryState>
    );

    expect(screen.getByText('NO DATA')).toBeTruthy();
    expect(screen.getByText('NOTHING HERE')).toBeTruthy();
    expect(screen.queryByText('CONTENT')).toBeNull();
    expect(screen.queryByRole('button', { name: i18n.t('common.retry') })).toBeNull();
  });

  it('renders children once every query has data', async () => {
    await render(
      <QueryState queries={[makeQuery(), makeQuery()]}>
        <Text>CONTENT</Text>
      </QueryState>
    );

    expect(screen.getByText('CONTENT')).toBeTruthy();
  });
});
