import React, { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../../src/api/client';
import { gql } from '../../../src/api/graphql';
import { BrandMark, Button, Chip, LoadingBlock, Screen, Subtitle, Title } from '../../../src/components/ui';
import { useCms } from '../../../src/context/CmsContext';
import type { Trip } from '../../../src/types';
import { colors, radii, spacing } from '../../../src/theme/tokens';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { appConfig } = useCms();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [narration, setNarration] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      return;
    }
    setError(null);
    try {
      const result = await api.getTrip(id);
      setTrip(result.trip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trip');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  async function togglePacked(itemId: string) {
    if (!trip) {
      return;
    }
    const packingList = trip.packingList.map((item) =>
      item.id === itemId ? { ...item, packed: !item.packed } : item
    );
    setBusy(true);
    try {
      const result = await api.updateTrip(trip.id, { packingList });
      setTrip(result.trip);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function rollChaos() {
    if (!trip) {
      return;
    }
    setBusy(true);
    setNarration(null);
    try {
      const result = await gql.rollChaosDice(trip.id);
      setTrip(result.trip);
      setNarration(result.narration);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chaos failed');
    } finally {
      setBusy(false);
    }
  }

  async function markLegendary() {
    if (!trip) {
      return;
    }
    if (trip.chaosScore < appConfig.minChaosForLegendary) {
      setError(
        `Score needs to be at least ${appConfig.minChaosForLegendary} before you can mark this complete (currently ${trip.chaosScore}).`
      );
      return;
    }
    setBusy(true);
    try {
      const result = await api.updateTrip(trip.id, {
        status: 'legendary',
        stampEarned: true,
      });
      setTrip(result.trip);
      setNarration('Trip marked complete — passport stamp added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update trip');
    } finally {
      setBusy(false);
    }
  }

  async function removeTrip() {
    if (!trip) {
      return;
    }
    Alert.alert('Delete trip?', 'This cannot be undone.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await api.deleteTrip(trip.id);
            router.back();
          })();
        },
      },
    ]);
  }

  if (loading && !trip) {
    return (
      <Screen>
        <LoadingBlock label="Loading trip…" />
      </Screen>
    );
  }

  if (!trip) {
    return (
      <Screen>
        <Title>Trip missing</Title>
        <Subtitle>{error ?? 'Not found'}</Subtitle>
        <Button label="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen style={{ paddingBottom: 0 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <BrandMark />
        <Button label="← Back to trips" variant="ghost" onPress={() => router.back()} />
        <Title>{trip.title}</Title>
        <Subtitle>
          {trip.destination} · {trip.startDate} → {trip.endDate}
        </Subtitle>

        <View style={styles.row}>
          <Chip
            label={
              trip.status === 'legendary'
                ? 'completed'
                : trip.status === 'in_progress'
                  ? 'in progress'
                  : trip.status.replace('_', ' ')
            }
            tone="seafoam"
          />
          <Chip label={`score ${trip.chaosScore}`} tone="coral" />
          {trip.stampEarned ? <Chip label="stamped" tone="amber" /> : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {narration ? <Text style={styles.narration}>{narration}</Text> : null}

        <Text style={styles.section}>Itinerary</Text>
        {trip.itinerary.map((day) => (
          <View key={`${day.day}-${day.title}`} style={styles.card}>
            <Text style={styles.day}>Day {day.day}</Text>
            <Text style={styles.cardTitle}>{day.title}</Text>
            <Text style={styles.body}>{day.detail}</Text>
          </View>
        ))}

        <Text style={styles.section}>Packing list</Text>
        {trip.packingList.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => void togglePacked(item.id)}
            style={styles.packRow}
            disabled={busy}
          >
            <Text style={styles.packCheck}>{item.packed ? '☑' : '☐'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{item.label}</Text>
            </View>
          </Pressable>
        ))}

        <Text style={styles.section}>Notes</Text>
        <Text style={styles.body}>{trip.notes || 'No notes yet.'}</Text>

        {appConfig.enableChaosDice ? (
          <Button
            label={busy ? 'Rolling…' : 'Add a surprise event'}
            onPress={() => void rollChaos()}
            variant="coral"
            disabled={busy}
          />
        ) : null}
        <Button
          label={
            trip.stampEarned
              ? 'Already completed'
              : `Mark complete (score ≥ ${appConfig.minChaosForLegendary})`
          }
          onPress={() => void markLegendary()}
          disabled={busy || trip.stampEarned}
        />
        <Button label="Delete trip" variant="ghost" onPress={removeTrip} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  section: {
    fontFamily: 'Syne_700Bold',
    color: colors.amber,
    fontSize: 18,
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 4,
  },
  day: {
    fontFamily: 'DMSans_500Medium',
    color: colors.seafoam,
    fontSize: 12,
  },
  cardTitle: {
    fontFamily: 'DMSans_700Bold',
    color: colors.white,
  },
  body: {
    fontFamily: 'DMSans_400Regular',
    color: colors.foam,
    lineHeight: 22,
  },
  meta: {
    fontFamily: 'DMSans_400Regular',
    color: colors.slate,
    fontSize: 12,
  },
  packRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  packCheck: {
    fontSize: 20,
    color: colors.seafoam,
    width: 28,
  },
  narration: {
    fontFamily: 'DMSans_700Bold',
    color: colors.coral,
    lineHeight: 22,
  },
  error: {
    color: colors.danger,
    fontFamily: 'DMSans_500Medium',
  },
});
