import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { CrashSuspect } from '../utils/incidents';
import type { NetworkEvent } from '../utils/network-event-types';
import type { MockifyerCrashFallbackProps, MockifyerHopListProps } from './MockifyerHopList.types';

export type { MockifyerCrashFallbackProps, MockifyerHopListProps } from './MockifyerHopList.types';

const DEFAULT_VISIBLE_HOPS = 8;

function isSuspect(hop: NetworkEvent, suspects?: CrashSuspect[]): boolean {
  if (!suspects?.length) return Boolean(hop.anomalyFlags?.length);
  return suspects.some((s) => s.eventId === hop.id);
}

function formatHopLine(hop: NetworkEvent): string {
  const parts = [hop.method, hop.url, hop.source];
  if (hop.status != null) parts.push(String(hop.status));
  if (hop.requestId) parts.push(hop.requestId);
  if (hop.anomalyFlags?.length) parts.push(`⚠ ${hop.anomalyFlags.join(', ')}`);
  return parts.join(' · ');
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
  return (
    <View style={styles.hopRow}>
      <Text style={[styles.hopText, suspect ? styles.suspectText : undefined]}>
        {isPrefetch ? '(prefetch) ' : ''}
        {formatHopLine(hop)}
      </Text>
    </View>
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
        <Text style={styles.mutedText}>No Mockifyer hops in this time window.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>
        {`Network context (${hops.length} hop${hops.length === 1 ? '' : 's'}, most relevant first)`}
      </Text>
      {items.map((hop) => (
        <HopRow key={hop.id} hop={hop} suspects={suspects} prefetchHopIds={prefetchHopIds} />
      ))}
    </View>
  );
}

/** Default ErrorBoundary fallback — error first; ranked hops visible by default. */
export function MockifyerCrashFallback({
  error,
  crashContext,
  incidentId,
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

      {hopCount > 0 ? (
        <View style={styles.hopsSection}>
          <Text style={suspectCount > 0 ? styles.suspectSummary : styles.hopSummary}>
            {suspectCount > 0
              ? `${suspectCount} hop${suspectCount === 1 ? '' : 's'} flagged · showing most relevant first`
              : `${hopCount} hop${hopCount === 1 ? '' : 's'} in window · showing most relevant first`}
          </Text>

          <View style={[styles.card, styles.hopListCard]}>
            {visibleHops.map((hop) => (
              <HopRow
                key={hop.id}
                hop={hop}
                suspects={crashContext!.suspects}
                prefetchHopIds={crashContext!.prefetchHopIds}
              />
            ))}
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
});
