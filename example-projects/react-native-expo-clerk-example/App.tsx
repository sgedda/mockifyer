import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { MockifyerInstance } from '@sgedda/mockifyer-fetch';
import { initializeMockifyer } from './mockifyer-setup-simple';
import { AuthProvider, useAppAuth } from './src/auth/auth-context';
import { MockifyerAppProvider } from './src/mockifyer-context';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';

function RootShell(props: { mockifyerReady: boolean }): React.ReactElement {
  const { mockifyerReady } = props;
  const { hydrated: authHydrated, user } = useAppAuth();

  if (!mockifyerReady || !authHydrated) {
    return (
      <View style={styles.blocking}>
        <ActivityIndicator size="large" color="#38bdf8" />
        <Text style={styles.mockLoading}>
          {!mockifyerReady ? 'Initializing Mockifyer…' : 'Restoring session…'}
        </Text>
      </View>
    );
  }

  return user ? <DashboardScreen /> : <LoginScreen />;
}

export default function App(): React.ReactElement {
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
      <MockifyerAppProvider
        value={{ initialized: mockifyerInitialized, instance: mockifyerInstance }}
      >
        <AuthProvider>
          <RootShell mockifyerReady={mockifyerInitialized} />
        </AuthProvider>
      </MockifyerAppProvider>
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
  mockLoading: {
    marginTop: 16,
    fontSize: 15,
    color: '#94a3b8',
  },
});
