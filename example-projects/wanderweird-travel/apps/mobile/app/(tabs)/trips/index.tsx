import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SectionList,
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

interface TripSection {
  title: string;
  data: GraphQlTrip[];
}

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

function daysUntilValue(trip: GraphQlTrip): number {
  if (typeof trip.daysUntil === 'number') {
    return trip.daysUntil;
  }
  const start = Date.parse(trip.startDate);
  if (Number.isNaN(start)) {
    return 0;
  }
  return Math.ceil((start - Date.now()) / (1000 * 60 * 60 * 24));
}

function isUpcoming(trip: GraphQlTrip): boolean {
  return daysUntilValue(trip) >= 0;
}

function partitionTrips(trips: GraphQlTrip[]): TripSection[] {
  const upcoming = trips
    .filter(isUpcoming)
    .sort((a, b) => daysUntilValue(a) - daysUntilValue(b));
  const past = trips
    .filter((trip) => !isUpcoming(trip))
    .sort((a, b) => daysUntilValue(b) - daysUntilValue(a));

  const sections: TripSection[] = [];
  if (upcoming.length > 0) {
    sections.push({ title: 'Upcoming', data: upcoming });
  }
  if (past.length > 0) {
    sections.push({ title: 'Past', data: past });
  }
  return sections;
}

function TripCard({ trip, onPress }: { trip: GraphQlTrip; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardTitle}>{trip.title}</Text>
        <Chip label={statusLabel(trip.status)} tone={statusTone(trip.status)} />
      </View>
      <Text style={styles.destination}>{trip.destination}</Text>
      <Text style={styles.meta}>
        {trip.startDate} → {trip.endDate}
        {formatCountdown(trip.daysUntil)}
      </Text>
      <Text style={styles.meta}>
        Packed {trip.packingProgress}%
        {trip.vibe ? ` · ${trip.vibe}` : ''}
      </Text>
    </Pressable>
  );
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

  const sections = useMemo(() => partitionTrips(trips), [trips]);

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
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
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
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No trips yet. Create one to get started.</Text>
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.section}>
            {section.title}
            {section.data.length > 0 ? ` (${section.data.length})` : ''}
          </Text>
        )}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? null : <View style={styles.sectionGap} />
        }
        renderItem={({ item }) => (
          <TripCard trip={item} onPress={() => router.push(`/(tabs)/trips/${item.id}`)} />
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
  sectionGap: {
    height: spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(232,244,242,0.08)',
    marginBottom: spacing.sm,
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
