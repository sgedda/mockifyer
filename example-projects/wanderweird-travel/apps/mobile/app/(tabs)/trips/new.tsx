import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../../../src/api/client';
import { gql } from '../../../src/api/graphql';
import { BrandMark, Button, Screen, Subtitle, Title } from '../../../src/components/ui';
import { useAuth } from '../../../src/context/AuthContext';
import type { DestinationOption } from '../../../src/types';
import { colors, radii, spacing } from '../../../src/theme/tokens';

export default function NewTripScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [destinations, setDestinations] = useState<DestinationOption[]>([]);
  const [destinationKey, setDestinationKey] = useState('atlantis');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [startDate, setStartDate] = useState('2026-08-01');
  const [endDate, setEndDate] = useState('2026-08-04');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.destinations().then((result) => {
      setDestinations(result.destinations);
      if (result.destinations[0]) {
        setDestinationKey(result.destinations[0].key);
      }
    });
  }, []);

  async function onCreate() {
    if (!user) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const trip = await gql.createTrip({
        userId: user.id,
        destinationKey,
        title: title.trim() || undefined,
        notes,
        startDate,
        endDate,
      });
      router.replace(`/(tabs)/trips/${trip.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen style={{ paddingBottom: 0 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <BrandMark />
        <Title>New trip</Title>
        <Subtitle>Choose a destination and dates for your itinerary.</Subtitle>

        <Text style={styles.label}>Destination</Text>
        <View style={styles.destList}>
          {destinations.map((dest) => (
            <Button
              key={dest.key}
              label={`${dest.name}`}
              variant={destinationKey === dest.key ? 'primary' : 'ghost'}
              onPress={() => setDestinationKey(dest.key)}
            />
          ))}
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Optional trip title"
          placeholderTextColor={colors.slate}
        />

        <Text style={styles.label}>Start date</Text>
        <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} autoCapitalize="none" />

        <Text style={styles.label}>End date</Text>
        <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} autoCapitalize="none" />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          multiline
          value={notes}
          onChangeText={setNotes}
          placeholder="Packing notes, reminders…"
          placeholderTextColor={colors.slate}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button
          label={busy ? 'Creating…' : 'Create trip'}
          onPress={() => void onCreate()}
          disabled={busy}
        />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
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
  destList: {
    gap: spacing.sm,
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
  error: {
    color: colors.danger,
    fontFamily: 'DMSans_500Medium',
  },
});
