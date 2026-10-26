import React from 'react';
import { Stack } from 'expo-router';
import { colors } from '../../../src/theme/tokens';

export default function TripsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.ink },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="content/[...slug]" />
    </Stack>
  );
}
