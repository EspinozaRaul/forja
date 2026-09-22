// Account scoping of the web progress hooks.
//
// The `.web.ts` variants are resolved by Metro on web only. Under Jest the
// `jest-expo` preset pins `haste.defaultPlatform: 'ios'` with
// `platforms: ['android', 'ios', 'native']`, and this repo's
// `moduleFileExtensions` carries no platform suffixes, so an implicit
// `lib/hooks/useProgress` import resolves to the NATIVE file here. These tests
// therefore import the explicit `.web` path, and the last case proves that the
// web module — not the native one — is the module under test.
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({ data: undefined, isLoading: false, error: null })),
}));

jest.mock('../../../lib/hooks/useCurrentUser', () => ({
  useCurrentUserId: jest.fn(),
}));

import { renderHook } from '@testing-library/react-native';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUserId } from '../../../lib/hooks/useCurrentUser';
import {
  useExerciseProgress,
  useSessionCountByWeek,
  useTotalVolumeByWeek,
} from '../../../lib/hooks/useProgress.web';
import { useExerciseProgressionData } from '../../../lib/hooks/useProgressionBubble.web';

type QueryOptions = {
  queryKey: unknown[];
  enabled?: boolean;
  refetchOnMount?: unknown;
  queryFn: () => Promise<unknown>;
};

const queryMock = useQuery as unknown as jest.Mock;
const userIdMock = useCurrentUserId as unknown as jest.Mock;

function latestOptions(): QueryOptions {
  const calls = queryMock.mock.calls;
  return calls[calls.length - 1][0] as QueryOptions;
}

const hooks: Array<[string, () => unknown]> = [
  ['useExerciseProgress', () => useExerciseProgress(1, undefined, undefined)],
  ['useSessionCountByWeek', () => useSessionCountByWeek()],
  ['useTotalVolumeByWeek', () => useTotalVolumeByWeek(1)],
  ['useExerciseProgressionData', () => useExerciseProgressionData(1)],
];

describe('web progress hooks are scoped to the account', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe.each(hooks)('%s', (_name, useHook) => {
    it('appends userId as the last queryKey element and enables the query', async () => {
      userIdMock.mockReturnValue('user-a');
      await renderHook(useHook);

      const options = latestOptions();
      expect(options.queryKey[options.queryKey.length - 1]).toBe('user-a');
      expect(options.enabled).toBe(true);
    });

    it('keys under null and disables the query when there is no user', async () => {
      userIdMock.mockReturnValue(null);
      await renderHook(useHook);

      const options = latestOptions();
      expect(options.queryKey[options.queryKey.length - 1]).toBeNull();
      expect(options.enabled).toBe(false);
    });
  });

  it('keeps refetchOnMount on the progression hook, like the native contract', async () => {
    userIdMock.mockReturnValue('user-a');
    await renderHook(() => useExerciseProgressionData(1));

    expect(latestOptions().refetchOnMount).toBe(true);
  });

  it('exercises the web module and not the native one', async () => {
    userIdMock.mockReturnValue('user-a');
    await renderHook(() => useSessionCountByWeek());

    // The sample payload exists only in `useProgress.web.ts`; the native
    // hook's queryFn reaches the Drizzle layer instead.
    await expect(latestOptions().queryFn()).resolves.toEqual([
      { date: '2026-W28', value: 3 },
      { date: '2026-W27', value: 2 },
      { date: '2026-W26', value: 4 },
      { date: '2026-W25', value: 1 },
    ]);
  });

  it('separates the cache keys of two different accounts', async () => {
    userIdMock.mockReturnValue('user-a');
    await renderHook(() => useExerciseProgress(1));
    const keyA = latestOptions().queryKey;

    userIdMock.mockReturnValue('user-b');
    await renderHook(() => useExerciseProgress(1));
    const keyB = latestOptions().queryKey;

    // The whole point of the fix: without the account suffix these collide.
    expect(keyA).not.toEqual(keyB);
    expect(keyA[keyA.length - 1]).toBe('user-a');
    expect(keyB[keyB.length - 1]).toBe('user-b');
  });

  it('stays account-keyed and disabled when the exercise id is absent', async () => {
    userIdMock.mockReturnValue('user-a');

    await renderHook(() => useExerciseProgress(0));
    const exercise = latestOptions();
    expect(exercise.queryKey[exercise.queryKey.length - 1]).toBe('user-a');
    expect(exercise.enabled).toBe(false);

    await renderHook(() => useExerciseProgressionData(null));
    const progression = latestOptions();
    expect(progression.queryKey[progression.queryKey.length - 1]).toBe('user-a');
    expect(progression.enabled).toBe(false);
  });

  it('keeps the session-count key account-scoped when an exerciseId is supplied', async () => {
    userIdMock.mockReturnValue('user-a');
    await renderHook(() => useSessionCountByWeek(7));

    const options = latestOptions();
    expect(options.queryKey).toEqual(['progress', 'sessionCount', 7, 'user-a']);
    expect(options.enabled).toBe(true);
  });
});
