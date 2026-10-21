import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import type { CmsContentChild, CmsTabNode } from '../types';
import { colors, radii, spacing } from '../theme/tokens';

export function CmsHero({ tab }: { tab?: CmsTabNode }) {
  if (!tab) {
    return null;
  }

  return (
    <View style={styles.hero}>
      {tab.heroImageUrl ? (
        <Image source={{ uri: tab.heroImageUrl }} style={styles.heroImage} resizeMode="cover" />
      ) : null}
      <View style={styles.heroScrim} />
      <View style={styles.heroText}>
        <Text style={styles.heroTitle}>{tab.heroTitle}</Text>
        <Text style={styles.heroSubtitle}>{tab.heroSubtitle}</Text>
      </View>
    </View>
  );
}

/**
 * Stack navigation entry points driven by CMS children.
 * parentPath lets nested pages push deeper: trip-tips → trip-tips/border-agent-etiquette
 */
export function CmsDeepLinks({
  screenKey,
  pages,
  parentPath = '',
  title = 'Guides',
}: {
  screenKey: string;
  pages?: CmsContentChild[];
  parentPath?: string;
  title?: string;
}) {
  const router = useRouter();
  if (!pages?.length) {
    return null;
  }

  return (
    <View style={styles.links}>
      <Text style={styles.section}>{title}</Text>
      {pages.map((page) => {
        const slugPath = parentPath ? `${parentPath}/${page.slug}` : page.slug;
        const nestedCount = page.children?.length ?? 0;
        const layout = page.pageConfig?.layoutMode;
        return (
          <Pressable
            key={page.id}
            onPress={() =>
              router.push(`/(tabs)/${screenKey}/content/${slugPath}` as Href)
            }
            style={({ pressed }) => [styles.linkCard, pressed && { opacity: 0.85 }]}
          >
            {page.imageUrl ? (
              <Image source={{ uri: page.imageUrl }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback]} />
            )}
            <View style={styles.linkBody}>
              <Text style={styles.linkTitle}>
                {page.featured ? '✦ ' : ''}
                {page.title.replace(/^✦\s+/, '')}
              </Text>
              <Text style={styles.linkPreview} numberOfLines={2}>
                {page.bodyText.split('\n\n')[0]}
              </Text>
              {nestedCount > 0 ? (
                <Text style={styles.linkMeta}>
                  {nestedCount} more {nestedCount === 1 ? 'article' : 'articles'}
                  {layout && layout !== 'story' ? ` · ${layout}` : ''}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Convenience wrapper for tab roots. */
export function CmsTabDeepLinks({
  screenKey,
  tab,
}: {
  screenKey: string;
  tab?: CmsTabNode;
}) {
  return <CmsDeepLinks screenKey={screenKey} pages={tab?.children} />;
}

const styles = StyleSheet.create({
  hero: {
    height: 160,
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: colors.mist,
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
  },
  heroScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7,19,26,0.45)',
  },
  heroText: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.md,
  },
  heroTitle: {
    fontFamily: 'Syne_700Bold',
    fontSize: 22,
    color: colors.white,
  },
  heroSubtitle: {
    fontFamily: 'DMSans_400Regular',
    color: colors.foam,
    marginTop: 4,
  },
  links: {
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  section: {
    fontFamily: 'Syne_700Bold',
    color: colors.amber,
    fontSize: 16,
  },
  linkCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(232,244,242,0.08)',
  },
  thumb: {
    width: 72,
    height: 72,
  },
  thumbFallback: {
    backgroundColor: colors.mist,
  },
  linkBody: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingRight: spacing.sm,
    justifyContent: 'center',
  },
  linkTitle: {
    fontFamily: 'DMSans_700Bold',
    color: colors.white,
    marginBottom: 2,
  },
  linkPreview: {
    fontFamily: 'DMSans_400Regular',
    color: colors.slate,
    fontSize: 13,
    lineHeight: 18,
  },
  linkMeta: {
    fontFamily: 'DMSans_500Medium',
    color: colors.seafoam,
    fontSize: 11,
    marginTop: 4,
  },
});
