import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAppAuth } from '@/auth/auth-context';
import { useMockifyerApp } from '../mockifyer-context';
import {
  DEMO_APIS,
  formatPreview,
  type DemoApiDefinition,
} from '../api/demo-requests';

type ApiCardState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; status: number; preview: string }
  | { phase: 'error'; message: string };

interface ApiResultCardProps {
  definition: DemoApiDefinition;
  state: ApiCardState;
  disabled: boolean;
  onRetry: () => void;
}

function ApiResultCard(props: ApiResultCardProps): React.ReactElement {
  const { definition, state, disabled, onRetry } = props;

  return (
    <View style={styles.snippetCard}>
      <Text style={styles.snippetTitle}>{definition.title}</Text>
      <Text style={styles.snippetDescription}>{definition.description}</Text>

      {state.phase === 'loading' ? (
        <View style={styles.cardStatusRow}>
          <ActivityIndicator color="#38bdf8" size="small" />
          <Text style={styles.cardStatusText}>Loading…</Text>
        </View>
      ) : null}

      {state.phase === 'done' ? (
        <View style={styles.cardResult}>
          <Text style={styles.cardStatusBadge}>HTTP {state.status}</Text>
          <Text style={styles.cardPreview}>{state.preview}</Text>
        </View>
      ) : null}

      {state.phase === 'error' ? (
        <Text style={styles.cardError}>{state.message}</Text>
      ) : null}

      {state.phase !== 'loading' ? (
        <Pressable
          style={({ pressed }) => [
            styles.snippetButton,
            (disabled || pressed) && styles.snippetButtonDimmed,
          ]}
          onPress={onRetry}
          disabled={disabled}
        >
          <Text style={styles.snippetButtonText}>
            {state.phase === 'idle' ? 'Run request' : 'Retry'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Post-login surface: varied HTTP hosts/methods so Mockifyer captures distinguishable traffic.
 * Requests run automatically once Mockifyer is ready.
 */
export function DashboardScreen(): React.ReactElement {
  const { user, signOut } = useAppAuth();
  const { initialized, instance } = useMockifyerApp();
  const [apiStates, setApiStates] = useState<Record<string, ApiCardState>>({});
  const [bulkLoading, setBulkLoading] = useState(false);
  const [log, setLog] = useState<string>(
    'APIs load automatically after login. Use Refresh all to re-run.',
  );

  const runSingleApi = useCallback(async (definition: DemoApiDefinition) => {
    setApiStates((prev) => ({ ...prev, [definition.id]: { phase: 'loading' } }));
    try {
      const outcome = await definition.run();
      const preview = formatPreview(outcome.body);
      setApiStates((prev) => ({
        ...prev,
        [definition.id]: {
          phase: 'done',
          status: outcome.status,
          preview,
        },
      }));
      return { id: definition.id, ok: true as const, status: outcome.status, preview };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setApiStates((prev) => ({
        ...prev,
        [definition.id]: { phase: 'error', message },
      }));
      return { id: definition.id, ok: false as const, message };
    }
  }, []);

  const runAllApis = useCallback(async () => {
    if (!initialized) {
      return;
    }
    setBulkLoading(true);
    setLog('Running sample APIs…');

    const results = await Promise.all(DEMO_APIS.map((definition) => runSingleApi(definition)));

    const okCount = results.filter((r) => r.ok).length;
    const failCount = results.length - okCount;
    const lastOk = [...results].reverse().find((r) => r.ok);

    if (lastOk && lastOk.ok) {
      setLog(
        `Loaded ${okCount}/${results.length} APIs (${failCount} failed).\nLast OK: ${lastOk.id} (${lastOk.status})\n${lastOk.preview}`,
      );
    } else {
      setLog(`Finished: ${okCount} succeeded, ${failCount} failed.`);
    }
    setBulkLoading(false);
  }, [initialized, runSingleApi]);

  useEffect(() => {
    if (!user || !initialized) {
      return;
    }
    void runAllApis();
  }, [user, initialized, runAllApis]);

  const reloadMocks = useCallback(async () => {
    if (instance && typeof instance.reloadMockData === 'function') {
      await instance.reloadMockData();
      setLog('Mockifyer: reloadMockData() finished. Next fetch uses refreshed mocks.');
      return;
    }
    setLog('Mockifyer instance has no reloadMockData (inactive mode).');
  }, [instance]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLog(`Sign out error: ${message}`);
    }
  }, [signOut]);

  if (!user) {
    return <View />;
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner}>
      <View style={styles.header}>
        <Text style={styles.heading}>Dashboard</Text>
        <Text style={styles.identity}>
          {[user.name, user.email].filter(Boolean).join(' · ') || user.id}{' '}
          <Text style={styles.identityProvider}>({user.provider})</Text>
        </Text>
        <Text style={styles.mockStatus}>
          Mockifyer: {initialized ? 'ready' : 'initializing…'}
        </Text>
        <Pressable style={styles.signOut} onPress={() => void handleSignOut()}>
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>Sample APIs (auto-loaded)</Text>
        <Pressable
          style={({ pressed }) => [
            styles.refreshAll,
            (!initialized || bulkLoading || pressed) && styles.refreshAllDimmed,
          ]}
          onPress={() => void runAllApis()}
          disabled={!initialized || bulkLoading}
        >
          {bulkLoading ? (
            <ActivityIndicator color="#0f172a" size="small" />
          ) : (
            <Text style={styles.refreshAllLabel}>Refresh all</Text>
          )}
        </Pressable>
      </View>

      {DEMO_APIS.map((definition) => (
        <ApiResultCard
          key={definition.id}
          definition={definition}
          state={apiStates[definition.id] ?? { phase: 'idle' }}
          disabled={!initialized || bulkLoading}
          onRetry={() => {
            void runSingleApi(definition);
          }}
        />
      ))}

      <Pressable
        style={styles.secondaryButton}
        onPress={() => void reloadMocks()}
        disabled={!initialized}
      >
        <Text style={styles.secondaryLabel}>Reload mocks (dev)</Text>
      </Pressable>

      <View style={styles.logBox}>
        <Text style={styles.logTitle}>Activity log</Text>
        <Text style={styles.logBody}>{log}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollInner: {
    padding: 20,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 20,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f8fafc',
  },
  identity: {
    marginTop: 6,
    fontSize: 15,
    color: '#94a3b8',
  },
  identityProvider: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  mockStatus: {
    marginTop: 8,
    fontSize: 13,
    color: '#64748b',
  },
  signOut: {
    alignSelf: 'flex-start',
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569',
  },
  signOutLabel: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  sectionLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  refreshAll: {
    backgroundColor: '#38bdf8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 96,
    alignItems: 'center',
  },
  refreshAllDimmed: {
    opacity: 0.65,
  },
  refreshAllLabel: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 13,
  },
  snippetCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  snippetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 6,
  },
  snippetDescription: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 12,
    lineHeight: 18,
  },
  cardStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardStatusText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  cardResult: {
    marginBottom: 12,
  },
  cardStatusBadge: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    color: '#34d399',
    backgroundColor: '#064e3b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  cardPreview: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 17,
    fontFamily: 'monospace',
  },
  cardError: {
    fontSize: 13,
    color: '#f87171',
    marginBottom: 12,
  },
  snippetButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  snippetButtonDimmed: {
    opacity: 0.65,
  },
  snippetButtonText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    marginTop: 8,
    marginBottom: 20,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  secondaryLabel: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
  logBox: {
    backgroundColor: '#020617',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  logTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  logBody: {
    fontSize: 13,
    color: '#cbd5e1',
    lineHeight: 18,
  },
});
