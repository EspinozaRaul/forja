// The root layout renders the database-failure screen while `useDatabase().error`
// is set, and that screen carries no detail. The release APK has no crash
// reporting either, so this hook is the only place a device failure can leave a
// trace: the log must not be gated behind `__DEV__`.
//
// One case per file, on purpose. `useDatabase` holds its "already initialized"
// flag at module scope, so a second case in this file would either short-circuit
// on the flag the first one left behind or need the module registry reset — and a
// hook loaded from a reset registry renders against a different React copy and
// dies with a null dispatcher.
jest.mock('../../../lib/db', () => ({
  initializeDatabase: jest.fn(),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { initializeDatabase } from '../../../lib/db';
import { useDatabase } from '../../../lib/hooks/useDatabase';

const init = initializeDatabase as jest.Mock;

/** `__DEV__` is a bare global assigned by the jest-expo preset, so it is writable. */
function setDev(value: boolean) {
  (globalThis as unknown as { __DEV__: boolean }).__DEV__ = value;
}

describe('useDatabase', () => {
  it('logs a failed initialization with __DEV__ off, and still surfaces the error', async () => {
    const dev = (globalThis as unknown as { __DEV__: boolean }).__DEV__;
    setDev(false);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('no such table: exercises');
    init.mockRejectedValue(failure);

    const { result } = await renderHook(() => useDatabase());

    // The screen the user sees reads `error`; the log is what a device failure
    // leaves behind for whoever debugs the release build.
    await waitFor(() => expect(result.current.error).toBe(failure));
    expect(errorSpy).toHaveBeenCalledWith('Database initialization failed:', failure);

    errorSpy.mockRestore();
    setDev(dev);
  });
});
