import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { gql, type GraphQlTrip } from '../../../src/api/graphql';
import { CmsTabDeepLinks } from '../../../src/components/CmsNav';
import { BrandMark, Button, Chip, LoadingBlock, Screen, Subtitle, Title } from '../../../src/components/ui';
import { useAuth } from '../../../src/context/AuthContext';
import { useCms } from '../../../src/context/CmsContext';
import type { Trip } from '../../../src/types';
import { colors, radii, spacing } from '../../../src/theme/tokens';

function statusTone(status: Trip['status']): 'seafoam' | 'coral' | 'amber' | 'mist' {
  if (status === 'legendary') return 'amber';
  if (status === 'booked') return 'seafoam';
  if (status === 'in_progress') return 'coral';
  return 'mist';
}

function statusLabel(status: Trip['status']): string {
  if (status === 'in_progress') return 'in progress';
  if (status === 'legendary') return 'completed';
  return status.replace('_', ' ');
}

function formatCountdown(daysUntil: number | null | undefined): string {
  if (daysUntil == null) {
    return '';
  }
  if (daysUntil > 1) {
    return ` · in ${daysUntil} days`;
  }
  if (daysUntil === 1) {
    return ' · tomorrow';
  }
  if (daysUntil === 0) {
    return ' · today';
  }
  return ` · ${Math.abs(daysUntil)} days ago`;
}

export default function TripsScreen() {
  const { user } = useAuth();
  const { getTab } = useCms();
  const tab = getTab('trips');
  const router = useRouter();
  const [trips, setTrips] = useState<GraphQlTrip[]>([]);
  const [headline, setHeadline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      return;
    }
    setError(null);
    try {
      const result = await gql.travelerDashboard(user.id);
      setHeadline(result.headline);
      setTrips(result.trips);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trips');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  if (loading && trips.length === 0) {
    return (
      <Screen>
        <LoadingBlock label="Loading trips…" />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.seafoam} />
        }
        ListHeaderComponent={
          <View>
            <BrandMark />
            <Title>{tab?.heroTitle ?? 'Your trips'}</Title>
            <Subtitle>
              {headline ??
                tab?.heroSubtitle ??
                `Hi ${user?.displayName ?? 'there'}. Plan and manage your upcoming travel.`}
            </Subtitle>
            <Button label="New trip" onPress={() => router.push('/(tabs)/trips/new')} />
            <CmsTabDeepLinks screenKey="trips" tab={tab} title="Travel guides" />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={styles.section}>Upcoming & recent</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No trips yet. Create one to get started.</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(tabs)/trips/${item.id}`)}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Chip label={statusLabel(item.status)} tone={statusTone(item.status)} />
            </View>
            <Text style={styles.destination}>{item.destination}</Text>
            <Text style={styles.meta}>
              {item.startDate} → {item.endDate}
              {formatCountdown(item.daysUntil)}
            </Text>
            <Text style={styles.meta}>
              Packed {item.packingProgress}%
              {item.vibe ? ` · ${item.vibe}` : ''}
            </Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: 0,
  },
  list: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  section: {
    fontFamily: 'DMSans_700Bold',
    color: colors.foam,
    fontSize: 15,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(232,244,242,0.08)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  cardTitle: {
    flex: 1,
    fontFamily: 'Syne_700Bold',
    fontSize: 18,
    color: colors.white,
  },
  destination: {
    fontFamily: 'DMSans_700Bold',
    color: colors.seafoam,
    marginBottom: 4,
  },
  meta: {
    fontFamily: 'DMSans_400Regular',
    color: colors.slate,
    marginBottom: 4,
  },
  empty: {
    fontFamily: 'DMSans_400Regular',
    color: colors.slate,
    marginTop: spacing.lg,
  },
  error: {
    color: colors.danger,
    fontFamily: 'DMSans_500Medium',
    marginTop: spacing.md,
  },
});
