import { Tabs, router } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, fontSizes, fontWeights, fonts } from '../../lib/theme/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg.primary },
        headerTintColor: colors.text.primary,
        headerTitleStyle: { color: colors.text.primary, fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.semibold },
        tabBarStyle: {
          backgroundColor: colors.bg.primary,
          borderTopColor: colors.border.primary,
          borderTopWidth: 1,
          // Height stays unset so react-navigation sizes the bar from the
          // device's own bottom inset (~34 on a gesture iPhone, ~48 with
          // Android 3-button nav, ~24 with Android gestures). Only a few
          // points are added on top of that inset to lift the labels off the
          // system chrome — a bigger number here recreates the empty band
          // that a fixed height produced.
          paddingBottom: insets.bottom + spacing.xs,
        },
        tabBarActiveTintColor: colors.accent.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: {
          fontSize: fontSizes.xs, fontFamily: fonts.bodySemiBold, fontWeight: fontWeights.semibold,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home.label'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              accessibilityLabel={t('accessibility.common.settings')}
              accessibilityRole="button"
              style={{ padding: spacing.sm }}
              hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
            >
              <Ionicons name="settings-outline" size={22} color={colors.text.secondary} />
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="routines"
        options={{
          title: t('tabs.routines.label'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: t('tabs.progress.label'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
