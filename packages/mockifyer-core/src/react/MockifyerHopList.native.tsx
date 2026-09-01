import { useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CrashSuspect } from '../utils/incidents';
import { looksLikeIntentionalTestCrash } from '../utils/incidents';
import { buildHopDisplayRows, formatHopLineForDisplay } from '../utils/hop-display';
import type { NetworkEvent } from '../utils/network-event-types';
import type { MockifyerCrashFallbackProps, MockifyerHopListProps } from './MockifyerHopList.types';

export type { MockifyerCrashFallbackProps, MockifyerHopListProps } from './MockifyerHopList.types';

const DEFAULT_VISIBLE_HOPS = 8;

function isSuspect(hop: NetworkEvent, suspects?: CrashSuspect[]): boolean {
  if (!suspects?.length) return Boolean(hop.anomalyFlags?.length);
  return suspects.some((s) => s.eventId === hop.id);
}

function HopRow({
  hop,
  suspects,
  prefetchHopIds,
}: {
  hop: NetworkEvent;
  suspects?: MockifyerHopListProps['suspects'];
  prefetchHopIds?: string[];
}): ReactNode {
  const suspect = isSuspect(hop, suspects);
  const isPrefetch = prefetchHopIds?.includes(hop.id);
  const hasPreview = Boolean(hop.responseBodyPreview?.trim());
  const [expanded, setExpanded] = useState(suspect && hasPreview);

  return (
    <Pressable
      accessibilityRole={hasPreview ? 'button' : undefined}
      disabled={!hasPreview}
      onPress={hasPreview ? () => setExpanded((v) => !v) : undefined}
      style={styles.hopRow}
    >
      <Text style={[styles.hopText, suspect ? styles.suspectText : undefined]}>
        {isPrefetch ? '(prefetch) ' : ''}
        {formatHopLineForDisplay(hop)}
      </Text>
      {hasPreview && !expanded ? (
        <Text style={styles.previewHint}>Tap for response preview</Text>
      ) : null}
      {hasPreview && expanded ? (
        <Text style={styles.previewText}>{hop.responseBodyPreview}</Text>
      ) : null}
    </Pressable>
  );
}

function ScreenHeader({ screen }: { screen: string }): ReactNode {
  return (
    <View style={styles.screenHeaderRow}>
      <Text style={styles.screenHeaderText}>{screen}</Text>
    </View>
  );
}

function HopTimeline({
  hops,
  suspects,
  prefetchHopIds,
}: {
  hops: NetworkEvent[];
  suspects?: CrashSuspect[];
  prefetchHopIds?: string[];
}): ReactNode {
  const rows = buildHopDisplayRows(hops);
  return (
    <>
      {rows.map((row, index) =>
        row.kind === 'screen-header' ? (
          <ScreenHeader key={`screen-${row.screen}-${index}`} screen={row.screen} />
        ) : (
          <HopRow
            key={row.hop.id}
            hop={row.hop}
            suspects={suspects}
            prefetchHopIds={prefetchHopIds}
          />
        )
      )}
    </>
  );
}

/** Read-only hop list — expects most-relevant-first order. */
export function MockifyerHopList({
  hops,
  suspects,
  prefetchHopIds,
  maxItems,
}: MockifyerHopListProps): ReactNode {
  const items = maxItems != null ? hops.slice(0, maxItems) : hops;

  if (items.length === 0) {
    return (
      <View style={[styles.card, styles.emptyCard]}>
        <Text style={styles.mutedText}>
          No Mockifyer hops in this time window. Browse CMS screens first so hops carry screen
          labels.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>
        {`Network context (${hops.length} hop${hops.length === 1 ? '' : 's'}, most relevant first)`}
      </Text>
      <HopTimeline hops={items} suspects={suspects} prefetchHopIds={prefetchHopIds} />
    </View>
  );
}

/** Default ErrorBoundary fallback — error first; ranked hops visible by default. */
export function MockifyerCrashFallback({
  error,
  crashContext,
  incidentId,
  dashboardExplainUrl,
  localTraceBrowseUrl,
  localTraceFileHint,
  visibleHopCount = DEFAULT_VISIBLE_HOPS,
}: MockifyerCrashFallbackProps): ReactNode {
  const [showAllHops, setShowAllHops] = useState(false);
  const [stackExpanded, setStackExpanded] = useState(false);

  const hops = crashContext?.hops ?? [];
  const hopCount = hops.length;
  const suspectCount = crashContext?.suspects.length ?? 0;
  const visibleHops = showAllHops ? hops : hops.slice(0, visibleHopCount);
  const hasMoreHops = hopCount > visibleHopCount;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.rootContent}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.errorMessage}>{error.message}</Text>

      {looksLikeIntentionalTestCrash(error.message) ? (
        <View style={styles.devBanner}>
          <Text style={styles.devBannerText}>
            Dev note: intentional test crash — network context below is for debugging.
          </Text>
        </View>
      ) : null}

      {error.stack ? (
        <View style={styles.stackSection}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setStackExpanded((v) => !v)}
            style={styles.button}
          >
            <Text style={styles.buttonText}>{stackExpanded ? 'Hide stack' : 'Show stack'}</Text>
          </Pressable>
          {stackExpanded ? <Text style={styles.stackTrace}>{error.stack}</Text> : null}
        </View>
      ) : null}

      {incidentId ? (
        <Text style={styles.incidentId}>{`Mockifyer incident: ${incidentId}`}</Text>
      ) : null}

      {dashboardExplainUrl ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void Linking.openURL(dashboardExplainUrl);
          }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Open in dashboard</Text>
        </Pressable>
      ) : null}

      {localTraceBrowseUrl ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void Linking.openURL(localTraceBrowseUrl);
          }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Open trace HTML</Text>
        </Pressable>
      ) : null}

      {localTraceFileHint ? (
        <Text style={styles.localFileHint}>{`Local: ${localTraceFileHint}`}</Text>
      ) : null}

      {hopCount > 0 ? (
        <View style={styles.hopsSection}>
          <Text style={suspectCount > 0 ? styles.suspectSummary : styles.hopSummary}>
            {suspectCount > 0
              ? `${suspectCount} hop${suspectCount === 1 ? '' : 's'} flagged · showing most relevant first`
              : `${hopCount} hop${hopCount === 1 ? '' : 's'} in window · showing most relevant first`}
          </Text>

          <View style={[styles.card, styles.hopListCard]}>
            <HopTimeline
              hops={visibleHops}
              suspects={crashContext!.suspects}
              prefetchHopIds={crashContext!.prefetchHopIds}
            />
          </View>

          {hasMoreHops ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowAllHops((v) => !v)}
              style={styles.button}
            >
              <Text style={styles.buttonText}>
                {showAllHops ? 'Show fewer hops' : `Show all ${hopCount} hops`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : crashContext ? (
        <View style={[styles.card, styles.emptyCard]}>
          <Text style={styles.mutedText}>
            {`No network hops in the last ${Math.round((crashContext.windowMs ?? 60000) / 1000)}s — browse AppDun / CMS screens with API traffic first so hops show screen and CMS labels`}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  rootContent: {
    padding: 16,
  },
  title: {
    color: '#ff6b6b',
    fontSize: 18,
    fontWeight: '700',
  },
  errorMessage: {
    color: '#ffb4b4',
    fontSize: 14,
    marginTop: 8,
  },
  devBanner: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 6,
    padding: 10,
    backgroundColor: '#2a2418',
  },
  devBannerText: {
    color: '#ffd166',
    fontSize: 12,
    lineHeight: 17,
  },
  stackSection: {
    marginTop: 8,
  },
  stackTrace: {
    color: '#888',
    fontSize: 11,
    marginTop: 8,
  },
  incidentId: {
    color: '#eee',
    opacity: 0.5,
    fontSize: 11,
    marginTop: 8,
  },
  hopsSection: {
    marginTop: 12,
  },
  suspectSummary: {
    color: '#ffd166',
    fontSize: 12,
    marginBottom: 8,
  },
  hopSummary: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#111',
  },
  emptyCard: {
    marginTop: 12,
    opacity: 0.8,
  },
  hopListCard: {
    marginTop: 0,
  },
  sectionTitle: {
    color: '#eee',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 8,
  },
  screenHeaderRow: {
    marginTop: 4,
    marginBottom: 2,
  },
  screenHeaderText: {
    color: '#7eb8ff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hopRow: {
    marginBottom: 6,
  },
  hopText: {
    color: '#eee',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Menlo',
  },
  suspectText: {
    color: '#ffb4b4',
  },
  previewHint: {
    color: '#888',
    fontSize: 10,
    marginTop: 2,
    fontStyle: 'italic',
  },
  previewText: {
    color: '#ccc',
    fontSize: 10,
    marginTop: 4,
    lineHeight: 14,
    fontFamily: 'Menlo',
  },
  mutedText: {
    color: '#eee',
    fontSize: 12,
    opacity: 0.8,
  },
  button: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#555',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  buttonText: {
    color: '#aaa',
    fontSize: 12,
  },
  localFileHint: {
    color: '#7eb8ff',
    fontSize: 11,
    marginTop: 6,
    fontFamily: 'Menlo',
  },
});
