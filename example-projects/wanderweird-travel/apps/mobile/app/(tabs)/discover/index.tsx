import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../../src/api/client';
import { CmsTabDeepLinks } from '../../../src/components/CmsNav';
import { BrandMark, Button, Chip, LoadingBlock, Screen, Subtitle, Title } from '../../../src/components/ui';
import { useCms } from '../../../src/context/CmsContext';
import type { DiscoverPayload, LuggageLotteryPayload } from '../../../src/types';
import { colors, radii, spacing } from '../../../src/theme/tokens';

export default function DiscoverScreen() {
  const { getTab, appConfig } = useCms();
  const tab = getTab('discover');
  const [discover, setDiscover] = useState<DiscoverPayload | null>(null);
  const [lottery, setLottery] = useState<LuggageLotteryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (destinationKey?: string, useDefault = true) => {
      setError(null);
      try {
        const key = useDefault && !destinationKey ? appConfig.defaultDiscoverKey : destinationKey;
        const payload = await api.discover(key);
        setDiscover(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load destination');
      } finally {
        setLoading(false);
      }
    },
    [appConfig.defaultDiscoverKey]
  );

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  async function drawLottery() {
    setDrawing(true);
    try {
      const result = await api.luggageLottery();
      setLottery(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not draw prize');
    } finally {
      setDrawing(false);
    }
  }

  if (loading && !discover) {
    return (
      <Screen>
        <LoadingBlock label="Loading destinations…" />
      </Screen>
    );
  }

  const weather = discover?.weather?.current as
    | { temperature_2m?: number; wind_speed_10m?: number }
    | undefined;
  const country = discover?.country as
    | {
        name?: string;
        capital?: string;
        region?: string;
        flagEmoji?: string;
        languages?: string[];
        population?: number;
      }
    | undefined;
  const currency = discover?.currency as { tip?: string } | undefined;
  const delay = discover?.delayActivity;
  const nearby = discover?.nearby;

  return (
    <Screen style={{ paddingBottom: 0 }}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.seafoam} />
        }
        contentContainerStyle={styles.content}
      >
        <BrandMark />
        <Title>{tab?.heroTitle ?? 'Discover'}</Title>
        <Subtitle>
          {tab?.heroSubtitle ??
            'Weather, currency tips, and nearby places for your next destination.'}
        </Subtitle>
        <CmsTabDeepLinks screenKey="discover" tab={tab} title="Guides" />

        {appConfig.maintenanceBanner ? (
          <Text style={styles.banner}>{appConfig.maintenanceBanner}</Text>
        ) : null}

        {error ? <Text testID="discover-error" style={styles.error}>{error}</Text> : null}

        {discover ? (
          <View style={styles.panel}>
            <View style={styles.placeHeader}>
              <Text testID="discover-place" style={styles.place}>{discover.destination.name}</Text>
              <Chip label={`match ${discover.serendipityScore}%`} tone="amber" />
            </View>
            <Text style={styles.blurb}>{discover.destination.blurb}</Text>

            <View style={styles.row}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Temperature</Text>
                <Text testID="discover-temperature" style={styles.statValue}>
                  {weather?.temperature_2m != null ? `${weather.temperature_2m}°` : '—'}
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Wind</Text>
                <Text style={styles.statValue}>
                  {weather?.wind_speed_10m != null ? `${weather.wind_speed_10m}` : '—'}
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Region</Text>
                <Text style={styles.statValue}>{country?.region ?? '—'}</Text>
              </View>
            </View>

            <Text style={styles.section}>Country</Text>
            <Text style={styles.body}>
              {country?.flagEmoji ? `${country.flagEmoji} ` : ''}
              {country?.name ?? 'Unknown'}
              {country?.capital ? ` · ${country.capital}` : ''}
            </Text>
            {country?.languages?.length ? (
              <Text style={styles.body}>Languages: {country.languages.join(', ')}</Text>
            ) : null}
            {country?.population != null ? (
              <Text style={styles.meta}>Population {country.population.toLocaleString()}</Text>
            ) : null}

            {currency?.tip ? (
              <>
                <Text style={styles.section}>Currency</Text>
                <Text style={styles.body}>{currency.tip}</Text>
              </>
            ) : null}

            {nearby?.places?.length ? (
              <>
                <Text style={styles.section}>Nearby places</Text>
                {nearby.places.map((place) => (
                  <Text key={place.xid} style={styles.body}>
                    · {place.name}
                    {place.distanceMeters != null ? ` · ${place.distanceMeters} m` : ''}
                  </Text>
                ))}
              </>
            ) : null}

            {delay ? (
              <>
                <Text style={styles.section}>If your flight is delayed</Text>
                <Text style={styles.advice}>{delay.activity}</Text>
              </>
            ) : null}

            <Text style={styles.section}>Tip of the day</Text>
            <Text style={styles.advice}>“{discover.advice.advice}”</Text>
          </View>
        ) : null}

        <Button label="Show another destination" onPress={() => void load(undefined, false)} variant="ghost" />

        {appConfig.showLuggageLottery ? (
          <View style={styles.lottery}>
            <Text style={styles.section}>Travel giveaway</Text>
            <Text style={styles.body}>A lighthearted prize draw for the trip.</Text>
            <Button
              label={drawing ? 'Drawing…' : 'Draw a prize'}
              onPress={() => void drawLottery()}
              variant="coral"
              disabled={drawing}
            />
            {lottery ? (
              <View style={styles.prize}>
                <Chip label={lottery.prize.rarity} tone="coral" />
                <Text style={styles.place}>{lottery.prize.title}</Text>
                <Text style={styles.body}>{lottery.prize.note}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  panel: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(232,244,242,0.08)',
    gap: spacing.sm,
  },
  placeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  place: {
    flex: 1,
    fontFamily: 'Syne_700Bold',
    fontSize: 24,
    color: colors.white,
  },
  blurb: {
    fontFamily: 'DMSans_400Regular',
    color: colors.slate,
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  stat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  statLabel: {
    fontFamily: 'DMSans_500Medium',
    color: colors.slate,
    fontSize: 12,
  },
  statValue: {
    fontFamily: 'Syne_700Bold',
    color: colors.seafoam,
    fontSize: 20,
    marginTop: 4,
  },
  section: {
    fontFamily: 'DMSans_700Bold',
    color: colors.foam,
    marginTop: spacing.sm,
  },
  body: {
    fontFamily: 'DMSans_400Regular',
    color: colors.foam,
    lineHeight: 22,
  },
  advice: {
    fontFamily: 'DMSans_500Medium',
    color: colors.white,
    fontSize: 16,
    lineHeight: 24,
  },
  meta: {
    fontFamily: 'DMSans_400Regular',
    color: colors.slate,
    fontSize: 13,
  },
  lottery: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  prize: {
    backgroundColor: 'rgba(255,92,77,0.1)',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  error: {
    color: colors.danger,
    fontFamily: 'DMSans_500Medium',
  },
  banner: {
    fontFamily: 'DMSans_500Medium',
    color: colors.amber,
    backgroundColor: 'rgba(240,180,41,0.12)',
    padding: spacing.sm,
    borderRadius: radii.sm,
  },
});
