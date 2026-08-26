import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const SETTINGS_STORAGE_KEY = 'app_settings';
const SETTINGS_QUERY_KEY = ['settings'];

export type WeightUnit = 'kg' | 'lbs';
export type AppLanguage = 'es' | 'en';

export interface AppSettings {
  weightUnit: WeightUnit;
  hapticsEnabled: boolean;
  soundEnabled: boolean;
  language: AppLanguage;
}

export const DEFAULT_SETTINGS: AppSettings = {
  weightUnit: 'kg',
  hapticsEnabled: true,
  soundEnabled: true,
  language: 'es',
};

// Synchronous mirror for hot paths (haptics, sound gating). Hydrated by
// getSettings, kept fresh by setSettings.
let cachedSettings: AppSettings = { ...DEFAULT_SETTINGS };

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<AppSettings>) : {};
    cachedSettings = { ...DEFAULT_SETTINGS, ...stored };
    return cachedSettings;
  } catch {
    cachedSettings = { ...DEFAULT_SETTINGS };
    return cachedSettings;
  }
}

export async function setSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const merged = { ...cachedSettings, ...patch };
  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
  cachedSettings = merged;
  return merged;
}

export function getCachedSettings(): AppSettings {
  return cachedSettings;
}

export function useSettings() {
  const queryClient = useQueryClient();

  const query = useQuery<AppSettings>({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: getSettings,
  });

  const mutation = useMutation({
    mutationFn: (patch: Partial<AppSettings>) => setSettings(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: SETTINGS_QUERY_KEY });
      const previous = queryClient.getQueryData<AppSettings>(SETTINGS_QUERY_KEY);
      queryClient.setQueryData<AppSettings>(SETTINGS_QUERY_KEY, (old) => ({
        ...(old ?? DEFAULT_SETTINGS),
        ...patch,
      }));
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(SETTINGS_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
    },
  });

  return {
    data: query.data ?? DEFAULT_SETTINGS,
    isLoading: query.isLoading,
    update: mutation.mutateAsync,
  };
}