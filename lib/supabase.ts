import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Check your .env file.'
  );
}

// SecureStore for encrypted token storage (production)
// Falls back to AsyncStorage in Expo Go where SecureStore isn't available
let SecureStore: typeof import('expo-secure-store') | null = null;
try {
  SecureStore = require('expo-secure-store');
} catch {
  // Running in Expo Go — SecureStore not available, using AsyncStorage
}

const storage = SecureStore
  ? {
      getItem: async (key: string) => SecureStore.getItemAsync(key),
      setItem: async (key: string, value: string) => SecureStore.setItemAsync(key, value),
      removeItem: async (key: string) => SecureStore.deleteItemAsync(key),
    }
  : {
      // Fallback for Expo Go — not encrypted but functional
      getItem: async (key: string) => AsyncStorage.getItem(key),
      setItem: async (key: string, value: string) => AsyncStorage.setItem(key, value),
      removeItem: async (key: string) => AsyncStorage.removeItem(key),
    };

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
