import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import {
  ClerkProvider,
  ClerkLoaded,
  ClerkLoading,
  SignedIn,
  SignedOut,
} from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import type { MockifyerInstance } from '@sgedda/mockifyer-fetch';
import { initializeMockifyer } from './mockifyer-setup-simple';
import { MockifyerAppProvider } from './src/mockifyer-context';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';

WebBrowser.maybeCompleteAuthSession();

function MissingClerkKeyScreen(): React.ReactElement {
  return (
    <View style={styles.blocking}>
      <Text style={styles.blockingTitle}>Clerk publishable key missing</Text>
      <Text style={styles.blockingBody}>
        Copy `.env.example` to `.env` and set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, then restart Expo with cache
        cleared (`expo start -c`) so the env var is inlined.
      </Text>
    </View>
  );
}

function ClerkGate(props: { publishableKey: string }): React.ReactElement {
  return (
    <ClerkProvider publishableKey={props.publishableKey} tokenCache={tokenCache}>
      <ClerkLoading>
        <View style={styles.blocking}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.mockLoading}>Loading Clerk…</Text>
        </View>
      </ClerkLoading>
      <ClerkLoaded>
        <SignedIn>
          <DashboardScreen />
        </SignedIn>
        <SignedOut>
          <LoginScreen />
        </SignedOut>
      </ClerkLoaded>
    </ClerkProvider>
  );
}

export default function App(): React.ReactElement {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() ?? '';
  const [mockifyerInitialized, setMockifyerInitialized] = useState(false);
  const [mockifyerInstance, setMockifyerInstance] = useState<MockifyerInstance | null>(null);

  useEffect(() => {
    let cancelled = false;
    void initializeMockifyer().then((result) => {
      if (cancelled) {
        return;
      }
      setMockifyerInstance(result.status === 'active' ? result.instance : null);
      setMockifyerInitialized(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      {!mockifyerInitialized ? (
        <View style={styles.blocking}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.mockLoading}>Initializing Mockifyer…</Text>
        </View>
      ) : !publishableKey ? (
        <MissingClerkKeyScreen />
      ) : (
        <MockifyerAppProvider
          value={{ initialized: mockifyerInitialized, instance: mockifyerInstance }}
        >
          <ClerkGate publishableKey={publishableKey} />
        </MockifyerAppProvider>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  blocking: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: '#0f172a',
  },
  blockingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 12,
  },
  blockingBody: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
  },
  mockLoading: {
    marginTop: 16,
    fontSize: 15,
    color: '#94a3b8',
  },
});
