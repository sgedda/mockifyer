import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../../src/api/client';
import { CmsTabDeepLinks } from '../../../src/components/CmsNav';
import { BrandMark, Chip, LoadingBlock, Screen, Subtitle, Title } from '../../../src/components/ui';
import { useAuth } from '../../../src/context/AuthContext';
import { useCms } from '../../../src/context/CmsContext';
import type { PassportPayload } from '../../../src/types';
import { colors, radii, spacing } from '../../../src/theme/tokens';

export default function PassportScreen() {
  const { user } = useAuth();
  const { getTab } = useCms();
  const tab = getTab('passport');
  const [passport, setPassport] = useState<PassportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      return;
    }
    setError(null);
    try {
      const result = await api.passport(user.id);
      setPassport(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load passport');
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

  if (loading && !passport) {
    return (
      <Screen>
        <LoadingBlock label="Loading passport…" />
      </Screen>
    );
  }

  return (
    <Screen style={{ paddingBottom: 0 }}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.seafoam} />
        }
        contentContainerStyle={styles.content}
      >
        <BrandMark />
        <Title>{tab?.heroTitle ?? 'Passport'}</Title>
        <Subtitle>
          {tab?.heroSubtitle ??
            'Stamps you earn when a trip is marked complete.'}
        </Subtitle>
        <CmsTabDeepLinks screenKey="passport" tab={tab} title="Guides" />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={[styles.book, { borderColor: user?.passportColor ?? colors.coral }]}>
          <Text style={styles.bookTitle}>{user?.displayName}</Text>
          <Text style={styles.bookMeta}>{user?.email}</Text>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{passport?.tripsLogged ?? 0}</Text>
              <Text style={styles.statLabel}>Trips</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{passport?.legendaryCount ?? 0}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{passport?.averageChaos ?? 0}</Text>
              <Text style={styles.statLabel}>Avg score</Text>
            </View>
          </View>
        </View>

        <Text style={styles.section}>Stamps</Text>
        {(passport?.stamps ?? []).length === 0 ? (
          <Text style={styles.empty}>
            No stamps yet. Finish a trip and mark it complete to collect one.
          </Text>
        ) : (
          passport?.stamps.map((stamp) => (
            <View key={stamp.tripId} style={styles.stamp}>
              <Chip label={stamp.destinationKey} tone="seafoam" />
              <Text style={styles.stampTitle}>{stamp.destination}</Text>
              <Text style={styles.stampMeta}>{stamp.vibe}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  book: {
    borderWidth: 2,
    borderRadius: radii.lg,
    padding: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: spacing.sm,
  },
  bookTitle: {
    fontFamily: 'Syne_800ExtraBold',
    fontSize: 28,
    color: colors.white,
  },
  bookMeta: {
    fontFamily: 'DMSans_400Regular',
    color: colors.slate,
  },
  stats: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'Syne_700Bold',
    fontSize: 22,
    color: colors.seafoam,
  },
  statLabel: {
    fontFamily: 'DMSans_400Regular',
    color: colors.slate,
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    fontFamily: 'DMSans_700Bold',
    color: colors.foam,
    fontSize: 16,
  },
  stamp: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 6,
  },
  stampTitle: {
    fontFamily: 'DMSans_700Bold',
    color: colors.white,
    fontSize: 16,
  },
  stampMeta: {
    fontFamily: 'DMSans_400Regular',
    color: colors.slate,
  },
  empty: {
    fontFamily: 'DMSans_400Regular',
    color: colors.slate,
  },
  error: {
    color: colors.danger,
    fontFamily: 'DMSans_500Medium',
  },
});
