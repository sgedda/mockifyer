import React, { useCallback, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, useSegments, type Href } from 'expo-router';
import { api } from '../api/client';
import { BrandMark, Button, Chip, LoadingBlock, Screen, Subtitle, Title } from './ui';
import { CmsDeepLinks } from './CmsNav';
import type { CmsContentChild, CmsPageConfig } from '../types';
import { colors, radii, spacing } from '../theme/tokens';

function screenKeyFromSegments(segments: string[]): string {
  const tabsIndex = segments.indexOf('(tabs)');
  if (tabsIndex >= 0 && segments[tabsIndex + 1]) {
    return segments[tabsIndex + 1];
  }
  return 'trips';
}

function slugPathFromParam(slug: string | string[] | undefined): string {
  if (Array.isArray(slug)) {
    return slug.filter(Boolean).join('/');
  }
  return String(slug ?? '');
}

function defaultPageConfig(page: CmsContentChild): CmsPageConfig {
  return {
    layoutMode: 'story',
    showChaosMeter: true,
    showShareSheet: false,
    primaryAction: 'back',
    deepLinkPath: '',
    externalUrl: '',
    extras: {},
    ...page.pageConfig,
  };
}

interface Breadcrumb {
  slug: string;
  title: string;
  slugPath: string;
}

/**
 * Shared stacked CMS page for every bottom-tab stack.
 * Route files under `/(tabs)/{tab}/content/[...slug]` re-export this screen.
 * Layout / CTA behavior comes from Umbraco (or seed) pageConfig.
 * Nested children are linked recursively via CmsDeepLinks + parentPath.
 */
export function CmsContentScreen() {
  const { slug } = useLocalSearchParams<{ slug: string | string[] }>();
  const segments = useSegments();
  const router = useRouter();
  const screenKey = screenKeyFromSegments(segments as string[]);
  const slugPath = slugPathFromParam(slug);
  const [page, setPage] = useState<CmsContentChild | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [descendantCount, setDescendantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);
      void api
        .cmsPage(screenKey, slugPath)
        .then((result) => {
          if (active) {
            setPage(result.page);
            setBreadcrumbs(result.breadcrumbs ?? []);
            setDescendantCount(result.descendantCount ?? 0);
          }
        })
        .catch((err: unknown) => {
          if (active) {
            setError(err instanceof Error ? err.message : 'Failed to load CMS page');
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
      return () => {
        active = false;
      };
    }, [screenKey, slugPath])
  );

  if (loading) {
    return (
      <Screen>
        <LoadingBlock label="Loading article…" />
      </Screen>
    );
  }

  if (!page) {
    return (
      <Screen>
        <Title>Missing page</Title>
        <Subtitle>{error ?? 'Not found in Umbraco / seed'}</Subtitle>
        <Button label="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  const config = defaultPageConfig(page);
  const extras = config.extras ?? {};
  const ctaOverride =
    typeof extras.ctaLabelOverride === 'string' ? extras.ctaLabelOverride : undefined;
  const hint = typeof extras.hint === 'string' ? extras.hint : undefined;
  const checklistSeed = Array.isArray(extras.checklistSeed)
    ? extras.checklistSeed.map(String)
    : [];
  async function runPrimaryAction() {
    if (config.primaryAction === 'deepLink' && config.deepLinkPath) {
      router.push(config.deepLinkPath as never);
      return;
    }
    if (config.primaryAction === 'external' && config.externalUrl) {
      await Linking.openURL(config.externalUrl);
      return;
    }
    router.back();
  }

  const primaryLabel =
    ctaOverride ||
    (config.primaryAction === 'deepLink'
      ? page.ctaLabel || 'Continue'
      : config.primaryAction === 'external'
        ? 'Open link'
        : page.ctaLabel || 'Back');

  return (
    <Screen style={{ paddingBottom: 0 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <BrandMark />
        <Button label="← Back" variant="ghost" onPress={() => router.back()} />

        {breadcrumbs.length > 0 ? (
          <View style={styles.crumbRow}>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <View key={`${crumb.slugPath}-${index}`} style={styles.crumbItem}>
                  {index > 0 ? <Text style={styles.crumbSep}>/</Text> : null}
                  <Pressable
                    disabled={isLast}
                    onPress={() => {
                      if (!crumb.slugPath) {
                        router.push(`/(tabs)/${screenKey}` as Href);
                        return;
                      }
                      router.push(`/(tabs)/${screenKey}/content/${crumb.slugPath}` as Href);
                    }}
                  >
                    <Text style={[styles.crumb, isLast && styles.crumbActive]}>
                      {crumb.title.replace(/^✦\s+/, '')}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}

        <Title>{page.title}</Title>
        <View style={styles.metaRow}>
          {page.featured ? <Chip label="featured" tone="amber" /> : null}
          <Chip label={`${page.readingMinutes ?? 1} min read`} tone="seafoam" />
          {descendantCount > 0 ? (
            <Chip label={`${descendantCount} related`} tone="mist" />
          ) : null}
        </View>
        {page.topics?.length ? (
          <View style={styles.metaRow}>
            {page.topics.map((topic) => (
              <Chip key={topic} label={topic} tone="mist" />
            ))}
          </View>
        ) : null}
        {page.imageUrl ? (
          <Image source={{ uri: page.imageUrl }} style={styles.image} resizeMode="cover" />
        ) : null}
        <Text style={styles.body}>{page.bodyText}</Text>

        {config.layoutMode === 'checklist' && checklistSeed.length > 0 ? (
          <View style={styles.configBox}>
            <Text style={styles.section}>CMS checklist</Text>
            {checklistSeed.map((item) => (
              <Text key={item} style={styles.highlight}>
                ☐ {item}
              </Text>
            ))}
          </View>
        ) : null}

        {hint ? <Text style={styles.hint}>{hint}</Text> : null}

        {page.highlights?.length ? (
          <View>
            <Text style={styles.section}>Highlights</Text>
            {page.highlights.map((item) => (
              <Text key={item} style={styles.highlight}>
                · {item}
              </Text>
            ))}
          </View>
        ) : null}

        {page.enrichment ? (
          <View style={[styles.loreBox, page.accentColor ? { borderColor: page.accentColor } : null]}>
            <Text style={styles.section}>Related to your trip</Text>
            <Text style={styles.lore}>{page.enrichment.weatherFootnote}</Text>
            <Text style={styles.lore}>{page.enrichment.tripEcho}</Text>
            <Text style={styles.lore}>“{page.enrichment.adviceEcho}”</Text>
          </View>
        ) : null}

        <CmsDeepLinks
          screenKey={screenKey}
          pages={page.children}
          parentPath={slugPath}
          title={
            (page.children?.length ?? 0) > 0
              ? `More in this guide (${page.children?.length ?? 0})`
              : 'More in this guide'
          }
        />
        <Button label={primaryLabel} onPress={() => void runPrimaryAction()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  crumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 2,
  },
  crumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  crumbSep: {
    fontFamily: 'DMSans_400Regular',
    color: colors.slate,
    marginHorizontal: 2,
  },
  crumb: {
    fontFamily: 'DMSans_500Medium',
    color: colors.seafoam,
    fontSize: 13,
  },
  crumbActive: {
    color: colors.amber,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: radii.lg,
    backgroundColor: colors.mist,
  },
  body: {
    fontFamily: 'DMSans_400Regular',
    color: colors.foam,
    fontSize: 16,
    lineHeight: 26,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  section: {
    fontFamily: 'Syne_700Bold',
    color: colors.amber,
    marginBottom: spacing.xs,
  },
  highlight: {
    fontFamily: 'DMSans_400Regular',
    color: colors.foam,
    lineHeight: 22,
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    color: colors.seafoam,
    lineHeight: 22,
  },
  loreBox: {
    borderWidth: 1,
    borderColor: 'rgba(232,244,242,0.12)',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  configBox: {
    borderWidth: 1,
    borderColor: 'rgba(240,180,41,0.25)',
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: 'rgba(240,180,41,0.06)',
  },
  lore: {
    fontFamily: 'DMSans_400Regular',
    color: colors.slate,
    lineHeight: 22,
  },
  hops: {
    fontFamily: 'DMSans_500Medium',
    color: colors.seafoam,
    fontSize: 12,
    marginTop: spacing.sm,
  },
});
