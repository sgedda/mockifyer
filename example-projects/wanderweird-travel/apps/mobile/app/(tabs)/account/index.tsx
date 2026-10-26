import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CmsTabDeepLinks } from '../../../src/components/CmsNav';
import { BrandMark, Button, Screen, Subtitle, Title } from '../../../src/components/ui';
import { useAuth } from '../../../src/context/AuthContext';
import { useCms } from '../../../src/context/CmsContext';
import { colors, radii, spacing } from '../../../src/theme/tokens';

const TRAVEL_STYLES = [
  { value: 'mild', label: 'Relaxed' },
  { value: 'spicy', label: 'Adventurous' },
  { value: 'existential', label: 'Spontaneous' },
] as const;

export default function AccountScreen() {
  const router = useRouter();
  const { user, updateProfile, logout } = useAuth();
  const { getTab } = useCms();
  const tab = getTab('account');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [homeBase, setHomeBase] = useState(user?.homeBase ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [jetLag, setJetLag] = useState(String(user?.jetLagTolerance ?? 50));
  const [chaos, setChaos] = useState(user?.preferredChaos ?? 'spicy');
  const [passportColor, setPassportColor] = useState(user?.passportColor ?? '#FF5C4D');
  const [notifications, setNotifications] = useState(
    user?.notifications ?? {
      serendipityPings: true,
      luggageLottery: true,
      weatherWeirdness: true,
    }
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateProfile({
        displayName,
        homeBase,
        bio,
        jetLagTolerance: Number(jetLag) || 0,
        preferredChaos: chaos,
        passportColor,
        notifications,
      });
      setMessage('Settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen style={{ paddingBottom: 0 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <BrandMark />
        <Title>{tab?.heroTitle ?? 'Account'}</Title>
        <Subtitle>
          {tab?.heroSubtitle ?? 'Update your profile and notification preferences.'}
        </Subtitle>
        <CmsTabDeepLinks screenKey="account" tab={tab} title="About" />

        <Text style={styles.label}>Display name</Text>
        <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} />

        <Text style={styles.label}>Home base</Text>
        <TextInput style={styles.input} value={homeBase} onChangeText={setHomeBase} />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          multiline
          value={bio}
          onChangeText={setBio}
        />

        <Text style={styles.label}>Jet lag comfort (0–100)</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={jetLag}
          onChangeText={setJetLag}
        />

        <Text style={styles.label}>Travel style</Text>
        <View style={styles.chaosRow}>
          {TRAVEL_STYLES.map((option) => (
            <Button
              key={option.value}
              label={option.label}
              variant={chaos === option.value ? 'primary' : 'ghost'}
              onPress={() => setChaos(option.value)}
            />
          ))}
        </View>

        <Text style={styles.label}>Passport accent color</Text>
        <TextInput
          style={styles.input}
          value={passportColor}
          onChangeText={setPassportColor}
          autoCapitalize="none"
        />

        <Text style={styles.section}>Notifications</Text>
        {(
          [
            ['serendipityPings', 'Destination ideas'],
            ['luggageLottery', 'Travel giveaways'],
            ['weatherWeirdness', 'Weather updates'],
          ] as const
        ).map(([key, label]) => (
          <View key={key} style={styles.switchRow}>
            <Text style={styles.switchLabel}>{label}</Text>
            <Switch
              value={notifications[key]}
              onValueChange={(value) =>
                setNotifications((prev) => ({ ...prev, [key]: value }))
              }
              trackColor={{ true: colors.seafoam, false: colors.mist }}
            />
          </View>
        ))}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.ok}>{message}</Text> : null}

        <Button label={saving ? 'Saving…' : 'Save settings'} onPress={() => void onSave()} disabled={saving} />
        {__DEV__ ? (
          <Button
            label="Developer tools"
            variant="ghost"
            onPress={() => router.push('/dev-menu')}
          />
        ) : null}
        <Button label="Sign out" variant="ghost" onPress={() => void logout()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    color: colors.slate,
    marginTop: spacing.sm,
  },
  section: {
    fontFamily: 'DMSans_700Bold',
    color: colors.foam,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(232,244,242,0.14)',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.foam,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  chaosRow: {
    gap: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    fontFamily: 'DMSans_400Regular',
    color: colors.foam,
  },
  error: {
    color: colors.danger,
    fontFamily: 'DMSans_500Medium',
  },
  ok: {
    color: colors.seafoam,
    fontFamily: 'DMSans_500Medium',
  },
});
