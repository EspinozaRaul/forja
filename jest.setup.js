/* eslint-disable no-undef */

// AsyncStorage ships a native module that does not exist in the Jest
// environment. Without this mock, importing anything that reaches
// `lib/utils/settings.ts` (including `lib/i18n`) throws at import time:
//   [@RNC/AsyncStorage]: NativeModule: AsyncStorage is null.
// This is what previously made the i18n layer untestable.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// expo-localization reports en-US under Jest, which would make every
// language-dependent assertion depend on the machine running the tests.
// Pin it to the app's primary language (es is also the i18n fallback) so
// translation assertions are deterministic and match what most users see.
jest.mock('expo-localization', () => ({
  getLocales: () => [
    {
      languageTag: 'es-AR',
      languageCode: 'es',
      languageScriptCode: 'Latn',
      regionCode: 'AR',
      textDirection: 'ltr',
      measurementSystem: 'metric',
      temperatureUnit: 'celsius',
      decimalSeparator: ',',
      digitGroupingSeparator: '.',
    },
  ],
}));
