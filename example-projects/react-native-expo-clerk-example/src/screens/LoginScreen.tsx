import React, { useCallback, useState, type ReactElement } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAppAuth } from '@/auth/auth-context';

/** One-tap demo sign-in: no Clerk, no OAuth consoles, no API keys — session is stored on-device only. */
export function LoginScreen(): ReactElement {
  const { signInDemo } = useAppAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleDemo = useCallback(async () => {
    setErrorMessage(null);
    setBusy(true);
    try {
      await signInDemo();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrorMessage(msg);
    } finally {
      setBusy(false);
    }
  }, [signInDemo]);

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>
        This sample uses a built-in demo user only. Credentials are saved with{' '}
        <Text style={styles.bold}>SecureStore</Text> (native) or <Text style={styles.bold}>localStorage</Text>{' '}
        (web) — nothing talks to Clerk, Google, GitHub, or any other hosted auth product.
      </Text>

      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          (pressed || busy) && styles.primaryButtonPressed,
          busy && styles.primaryButtonDisabled,
        ]}
        onPress={() => {
          void handleDemo();
        }}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.primaryButtonLabel}>Continue as demo user</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bold: {
    fontWeight: '700',
    color: '#cbd5e1',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
    backgroundColor: '#0f172a',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    marginBottom: 24,
    lineHeight: 22,
  },
  errorBox: {
    backgroundColor: '#450a0a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#fecaca',
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#38bdf8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonLabel: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
});
