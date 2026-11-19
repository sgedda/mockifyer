import React, { useEffect, useMemo, useState } from 'react';
import { LogBox } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Syne_700Bold,
  Syne_800ExtraBold,
} from '@expo-google-fonts/syne';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { CmsProvider } from '../src/context/CmsContext';
import {
  MockifyerAppProvider,
  type MockifyerAppContextValue,
} from '../src/context/MockifyerContext';
import { initializeMockifyer } from '../src/mockifyer-setup';
import { registerMockifyerDevMenuShortcut } from '../src/dev/register-dev-menu';
import { readEnv } from '../src/dev/mockifyer-env';
import { LoadingBlock, Screen } from '../src/components/ui';
import { colors } from '../src/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Native e2e (e2e/native): LogBox warning banners would cover the tab bar the flows tap.
if (readEnv('EXPO_PUBLIC_E2E') === '1') {
  LogBox.ignoreAllLogs();
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }
    const root = segments[0];
    const inAuth = root === '(auth)';
    const inDevMenu = root === 'dev-menu';
    if (!user && !inAuth && !inDevMenu) {
      router.replace('/(auth)/login');
    } else if (user && inAuth) {
      router.replace('/(tabs)/trips');
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <Screen>
        <LoadingBlock label="Checking your passport…" />
      </Screen>
    );
  }

  return <>{children}</>;
}

function DevMenuShortcut() {
  const router = useRouter();

  useEffect(() => {
    return registerMockifyerDevMenuShortcut(router);
  }, [router]);

  return null;
}

export default function RootLayout() {
  const [mockReady, setMockReady] = useState(false);
  const [mockifyerValue, setMockifyerValue] = useState<MockifyerAppContextValue>({
    ready: false,
    status: 'pending',
    instance: null,
    backend: 'hybrid',
    dashboardBaseUrl: 'http://localhost:3002',
    clientId: 'wanderweird-demo',
  });
  const [fontsLoaded] = useFonts({
    Syne_700Bold,
    Syne_800ExtraBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const bootResult = await initializeMockifyer();
        if (cancelled) {
          return;
        }
        setMockifyerValue({
          ready: true,
          status: bootResult.result.status,
          instance: bootResult.result.instance,
          backend: bootResult.backend,
          dashboardBaseUrl: bootResult.dashboardBaseUrl,
          clientId: bootResult.clientId,
        });
      } catch (error) {
        console.warn('[Wanderweird] Mockifyer init failed', error);
        if (!cancelled) {
          setMockifyerValue((prev) => ({
            ...prev,
            ready: true,
            status: 'not_activated',
            instance: null,
          }));
        }
      } finally {
        if (!cancelled) {
          setMockReady(true);
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded && mockReady) {
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, mockReady]);

  const providerValue = useMemo(() => mockifyerValue, [mockifyerValue]);

  if (!fontsLoaded || !mockReady) {
    return (
      <Screen>
        <LoadingBlock label="Warming up the mockiverse…" />
      </Screen>
    );
  }

  return (
    <MockifyerAppProvider value={providerValue}>
      <AuthProvider>
        <CmsProvider>
          <StatusBar style="light" />
          <DevMenuShortcut />
          <AuthGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.ink },
                animation: 'fade',
              }}
            >
              <Stack.Screen name="(auth)/login" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="dev-menu"
                options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
              />
            </Stack>
          </AuthGate>
        </CmsProvider>
      </AuthProvider>
    </MockifyerAppProvider>
  );
}
