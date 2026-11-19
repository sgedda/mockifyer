import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradientish } from '../../src/components/Atmosphere';
import { BrandMark, Button, Subtitle, Title } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthContext';
import { colors, radii, spacing } from '../../src/theme/tokens';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('wanderer');
  const [password, setPassword] = useState('wanderer');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <LinearGradientish>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.wrap}
        testID="login-screen"
      >
        <View>
          <BrandMark />
          <Title>Plan your{'\n'}next trip</Title>
          <Subtitle>
            Browse destinations, save itineraries, and keep your travel notes in one place.
          </Subtitle>

          <View style={styles.form}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              testID="login-username"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
              style={styles.input}
              placeholderTextColor={colors.slate}
              placeholder="username"
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              testID="login-password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              placeholderTextColor={colors.slate}
              placeholder="password"
            />
            <Button
              testID="login-sign-in"
              label={busy ? 'Signing in…' : 'Sign in'}
              onPress={onSubmit}
              disabled={busy}
            />
            {error ? <Text testID="login-error" style={styles.error}>{error}</Text> : null}
          </View>
        </View>

        <View style={styles.hintBox}>
          <Text style={styles.hintTitle}>Demo accounts</Text>
          <Text style={styles.hint}>wanderer / wanderer</Text>
          <Text style={styles.hint}>jetlag / jetlag</Text>
        </View>
      </KeyboardAvoidingView>
    </LinearGradientish>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 72,
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
  },
  form: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    color: colors.slate,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(232,244,242,0.14)',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.foam,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
  },
  error: {
    color: colors.danger,
    fontFamily: 'DMSans_500Medium',
    marginTop: spacing.sm,
  },
  hintBox: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(232,244,242,0.1)',
    paddingTop: spacing.md,
    gap: 4,
  },
  hintTitle: {
    fontFamily: 'DMSans_700Bold',
    color: colors.foam,
    marginBottom: 4,
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    color: colors.slate,
  },
});
