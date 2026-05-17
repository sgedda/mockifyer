import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSignIn } from '@clerk/clerk-expo';

/**
 * Email + password sign-in using Clerk's future SignIn API (`signIn.password` + session activation).
 */
export function LoginScreen(): React.ReactElement {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    setFormError(null);
    if (!signIn || !setActive) {
      setFormError('Clerk sign-in is not ready yet.');
      return;
    }

    const trimmed = emailAddress.trim();
    if (!trimmed || !password) {
      setFormError('Enter email and password.');
      return;
    }

    setBusy(true);
    try {
      const signInWithPassword = signIn as {
        password?: (params: { emailAddress: string; password: string }) => Promise<{
          error: { errors?: Array<{ message?: string }>; message?: string } | null;
        }>;
      };

      if (typeof signInWithPassword.password !== 'function') {
        setFormError('This Clerk SDK does not expose email/password on signIn; update @clerk/clerk-expo.');
        return;
      }

      const { error } = await signInWithPassword.password({
        emailAddress: trimmed,
        password,
      });

      if (error) {
        const message =
          error.errors?.[0]?.message ??
          ('message' in error ? String(error.message) : null) ??
          'Sign-in failed. Check Clerk Dashboard (Email + Password enabled).';
        setFormError(message);
        return;
      }

      if (signIn.status === 'complete' && signIn.createdSessionId) {
        await setActive({ session: signIn.createdSessionId });
        return;
      }

      setFormError(
        `Sign-in needs another step (status: ${signIn.status}). Configure MFA off for this demo or extend the flow.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFormError(message);
    } finally {
      setBusy(false);
    }
  }, [emailAddress, password, setActive, signIn]);

  if (!isLoaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#38bdf8" />
        <Text style={styles.muted}>Loading Clerk…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>Use a Clerk user with email + password enabled.</Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder="you@example.com"
        placeholderTextColor="#64748b"
        value={emailAddress}
        onChangeText={setEmailAddress}
      />

      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="••••••••"
        placeholderTextColor="#64748b"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {formError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{formError}</Text>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.primaryButton,
          (busy || pressed) && styles.primaryButtonPressed,
          busy && styles.primaryButtonDisabled,
        ]}
        onPress={() => {
          void handleSubmit();
        }}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#0f172a" />
        ) : (
          <Text style={styles.primaryButtonLabel}>Continue</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0f172a',
  },
  muted: {
    marginTop: 12,
    color: '#94a3b8',
    fontSize: 14,
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
    marginBottom: 28,
    lineHeight: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#f8fafc',
    marginBottom: 18,
    backgroundColor: '#1e293b',
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
    marginTop: 8,
  },
  primaryButtonPressed: {
    opacity: 0.9,
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
