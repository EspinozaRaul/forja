// The auth effect gates the whole app: `app/_layout.tsx` renders the splash while
// `useAuth().loading` is true. This test pins the promise-rejection path — a throw
// while reading the stored session must still drop `loading` and clear the scope
// mirror, or the user never leaves the splash and a query could run unscoped.
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signOut: jest.fn(),
    },
  },
}));

jest.mock('../../../lib/db/queries', () => ({
  claimLegacyRows: jest.fn(),
  deleteUserLocalData: jest.fn(),
}));

jest.mock('../../../lib/db/user-scope', () => ({
  getCurrentUserId: jest.fn(() => null),
  setCurrentUserId: jest.fn(),
}));

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '../../../lib/hooks/useAuth';
import { supabase } from '../../../lib/supabase';
import { setCurrentUserId } from '../../../lib/db/user-scope';

const getSession = supabase.auth.getSession as jest.Mock;
const onAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock;

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
  });

  it('fails closed and unblocks when getSession rejects', async () => {
    // The hook logs the failure with console.error in dev; keep the suite output clean.
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    getSession.mockRejectedValue(new Error('storage exploded'));

    const { result } = await renderHook(() => useAuth(), { wrapper });

    // If the rejection path did not unblock, this waitFor would time out — which is
    // exactly the production symptom (an app stuck on the splash forever).
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(errorSpy).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(setCurrentUserId).toHaveBeenCalledWith(null);
    errorSpy.mockRestore();
  });

  it('sets the scope mirror before unblocking on a restored session', async () => {
    const { claimLegacyRows } = require('../../../lib/db/queries');
    getSession.mockResolvedValue({ data: { session: { user: { id: 'user-a' } } } });

    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user?.id).toBe('user-a');
    expect(setCurrentUserId).toHaveBeenCalledWith('user-a');
    expect(claimLegacyRows).toHaveBeenCalled();
  });
});
