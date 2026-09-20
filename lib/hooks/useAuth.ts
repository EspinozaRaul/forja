import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { claimLegacyRows, deleteUserLocalData, repairRoutineTargetDefaults } from '../db/queries';
import { getCurrentUserId, setCurrentUserId } from '../db/user-scope';
import { LocalizedAuthError } from '../auth/auth-error-message';
import { User, Session } from '@supabase/supabase-js';

// expo-web-browser is a native module — only available in dev builds, not Expo Go
// Google Sign-In is deferred to the Supabase migration week (Sept 8)
let WebBrowser: typeof import('expo-web-browser') | null = null;
try {
  WebBrowser = require('expo-web-browser');
  WebBrowser?.maybeCompleteAuthSession();
} catch {
  // Running in Expo Go — WebBrowser not available
}

// This is the Supabase callback URL - it will redirect back to the app
const REDIRECT_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/callback`;

// The account whose legacy rows this app session has already claimed. The
// backfill is idempotent, but this avoids a needless scan on every remount.
let backfilledUserId: string | null = null;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    const applySession = async (nextSession: Session | null) => {
      const userId = nextSession?.user?.id ?? null;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (userId) {
        // Mirror the id before any query can run, then adopt pre-auth rows so the
        // user's own existing data stays visible. Holding `loading` until the
        // backfill finishes is what guarantees that ordering — the root layout
        // gates every screen on `loading`. The per-account routine repair runs
        // here too, for the same reason: only now is the scope mirror set.
        setCurrentUserId(userId);
        if (backfilledUserId !== userId) {
          try {
            await claimLegacyRows();
          } catch (err) {
            if (__DEV__) console.error('Failed to claim legacy rows:', err);
          }
          try {
            await repairRoutineTargetDefaults();
          } catch (err) {
            if (__DEV__) console.error('Failed to repair routine target defaults:', err);
          }
          backfilledUserId = userId;
        }
      } else {
        // Sign-out keeps local rows (they stay owned by their account) but nothing
        // user-scoped may render for the next account, so drop the whole cache.
        setCurrentUserId(null);
        queryClient.clear();
      }

      if (!cancelled) setLoading(false);
    };

    // Get initial session. Fail CLOSED and unblock: if storage/session throws, we
    // must still drop `loading` (the root layout gates the whole app on it) and
    // clear the scope mirror so no query runs unscoped — applySession(null) does
    // both. Without this catch a throw left the user on the splash forever.
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        applySession(session);
      })
      .catch((err) => {
        if (__DEV__) console.error('Failed to restore session:', err);
        applySession(null);
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithGoogle = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: REDIRECT_URL,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Open the OAuth URL in the browser
        if (!WebBrowser) {
          return { error: new LocalizedAuthError('auth.errors.googleRequiresDevBuild') };
        }
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          REDIRECT_URL
        );

        if (result.type === 'success') {
          // The session will be set via onAuthStateChange
          return { error: null };
        } else {
          return { error: new LocalizedAuthError('auth.errors.loginCancelled') };
        }
      }

      return { error: new LocalizedAuthError('auth.errors.noOAuthUrl') };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const deleteAccount = async () => {
    try {
      // Read the active id BEFORE signing out: signing out clears the scope mirror.
      const userId = getCurrentUserId();
      const { error } = await supabase.rpc('delete_user_account');
      if (error) throw error;

      // Wipe this account's local rows and photo files. Signing out must not
      // delete rows, but deleting the account must.
      if (userId) {
        const photoUris = await deleteUserLocalData(userId);
        if (photoUris.length > 0) {
          const { File } = await import('expo-file-system');
          for (const uri of photoUris) {
            try {
              new File(uri).delete();
            } catch {
              // File already gone (cache eviction) — nothing to clean up
            }
          }
        }
      }

      await supabase.auth.signOut();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  };

  return {
    user,
    session,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    deleteAccount,
  };
}
