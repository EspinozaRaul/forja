import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#0A0A0A' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { color: '#FFFFFF', fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: '#0A0A0A',
          borderTopColor: '#2A2A2A',
          borderTopWidth: 1,
          height: 88,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#00F5A0',
        tabBarInactiveTintColor: '#666666',
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
