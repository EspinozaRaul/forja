import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { getSettings } from '../utils/settings';
import es from './es.json';
import en from './en.json';

const resources = {
  es: { translation: es },
  en: { translation: en },
} as const;

// Detect initial language: prefer stored setting, fallback to device locale, then 'es'
async function detectLanguage(): Promise<string> {
  try {
    const settings = await getSettings();
    if (settings.language) return settings.language;
  } catch {
    // ignore — fall through to device detection
  }

  const deviceLang = Localization.getLocales()[0]?.languageCode;
  if (deviceLang && deviceLang in resources) return deviceLang;

  return 'es';
}

// Initialize synchronously with default; re-detect async and update if needed
i18n.use(initReactI18next).init({
  resources,
  lng: 'es',
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

// Fire-and-forget async language detection
detectLanguage().then((lang) => {
  if (lang !== i18n.language) {
    i18n.changeLanguage(lang);
  }
});

export default i18n;
