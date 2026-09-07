import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
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

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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
          return { error: new Error('auth.errors.googleRequiresDevBuild') };
        }
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          REDIRECT_URL
        );

        if (result.type === 'success') {
          // The session will be set via onAuthStateChange
          return { error: null };
        } else {
          return { error: new Error('auth.errors.loginCancelled') };
        }
      }

      return { error: new Error('auth.errors.noOAuthUrl') };
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
      const { error } = await supabase.rpc('delete_user_account');
      if (error) throw error;
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
