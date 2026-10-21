import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/tokens';

export default function DiscoverStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.ink },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="content/[...slug]" />
    </Stack>
  );
}
