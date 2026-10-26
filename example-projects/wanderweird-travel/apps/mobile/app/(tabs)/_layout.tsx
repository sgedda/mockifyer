import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useCms } from '../../src/context/CmsContext';
import { colors } from '../../src/theme/tokens';

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ color: focused ? colors.seafoam : colors.slate, fontSize: 11, fontFamily: 'DMSans_700Bold' }}>
      {label}
    </Text>
  );
}

const FALLBACK_TABS = [
  { screenKey: 'trips', title: 'Trips', iconGlyph: '◆' },
  { screenKey: 'discover', title: 'Discover', iconGlyph: '✦' },
  { screenKey: 'passport', title: 'Passport', iconGlyph: '◎' },
  { screenKey: 'account', title: 'Account', iconGlyph: '◉' },
] as const;

export default function TabsLayout() {
  const { navigation } = useCms();
  const tabs = navigation?.tabs?.length
    ? navigation.tabs
    : FALLBACK_TABS.map((tab) => ({ ...tab, id: tab.screenKey }));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.deep,
          borderTopColor: 'rgba(232,244,242,0.08)',
          height: 64,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.seafoam,
        tabBarInactiveTintColor: colors.slate,
        tabBarLabelStyle: { fontFamily: 'DMSans_500Medium', fontSize: 11 },
      }}
    >
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.screenKey}
          name={tab.screenKey}
          options={{
            title: tab.title,
            href: (`/(tabs)/${tab.screenKey}` as unknown) as `/(tabs)/trips`,
            tabBarIcon: ({ focused }) => <TabIcon label={tab.iconGlyph} focused={focused} />,
          }}
        />
      ))}
    </Tabs>
  );
}
