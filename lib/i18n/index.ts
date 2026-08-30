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

// Synchronous initial language: device locale → 'es' fallback
// This prevents the es→en flash on first render for English users
const deviceLang = Localization.getLocales()[0]?.languageCode;
const initialLang = deviceLang && deviceLang in resources ? deviceLang : 'es';

// Initialize with device locale (synchronous, no flash)
i18n.use(initReactI18next).init({
  resources,
  lng: initialLang,
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

// Async: check stored user preference and override if different
// This runs after first render, so the user sees their device locale instantly
// and then switches to their stored preference if it differs
getSettings()
  .then((settings) => {
    if (settings.language && settings.language !== i18n.language) {
      i18n.changeLanguage(settings.language);
    }
  })
  .catch(() => {
    // ignore — device locale from init stays
  });

export default i18n;
