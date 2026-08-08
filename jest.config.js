module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@tanstack/react-query|drizzle-orm|expo-sqlite|expo-haptics|expo-linking|expo-constants|expo-status-bar|react-native-gesture-handler|react-native-reanimated|react-native-safe-area-context|react-native-screens|react-native-worklets|nativewind|tailwindcss|@testing-library/)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/__tests__/**/*.{ts,tsx,js,jsx}', '**/*.test.{ts,tsx,js,jsx}'],
};
