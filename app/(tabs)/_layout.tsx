import { Tabs, router } from 'expo-router';
import { Text, View, TouchableOpacity } from 'react-native';
import { colors, spacing } from '../../lib/theme/tokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg.primary },
        headerTintColor: colors.text.primary,
        headerTitleStyle: { color: colors.text.primary, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.bg.primary,
          borderTopColor: colors.border.primary,
          borderTopWidth: 1,
          height: 88,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent.primary,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ opacity: focused ? 1 : 0.7 }}>
              <Text style={{ color, fontSize: 22 }}>🏠</Text>
            </View>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              style={{ padding: spacing.sm }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ fontSize: 22, color: colors.text.secondary }}>⚙️</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Tabs.Screen
        name="routines"
        options={{
          title: 'Routines',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ opacity: focused ? 1 : 0.7 }}>
              <Text style={{ color, fontSize: 22 }}>📋</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ opacity: focused ? 1 : 0.7 }}>
              <Text style={{ color, fontSize: 22 }}>📈</Text>
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
