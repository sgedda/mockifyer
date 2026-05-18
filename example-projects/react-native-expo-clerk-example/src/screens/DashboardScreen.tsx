import React, { useCallback, useState } from 'react';
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

interface ApiSnippetProps {
  title: string;
  description: string;
  onPress: () => Promise<void>;
  disabled?: boolean;
}

function ApiSnippet(props: ApiSnippetProps): React.ReactElement {
  const { title, description, onPress, disabled } = props;
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    setLoading(true);
    try {
      await onPress();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.snippetCard}>
      <Text style={styles.snippetTitle}>{title}</Text>
      <Text style={styles.snippetDescription}>{description}</Text>
      <Pressable
        style={({ pressed }) => [
          styles.snippetButton,
          (disabled || pressed || loading) && styles.snippetButtonDimmed,
        ]}
        onPress={() => {
          void handlePress();
        }}
        disabled={disabled || loading}
      >
        {loading ? (
          <ActivityIndicator color="#e2e8f0" size="small" />
        ) : (
          <Text style={styles.snippetButtonText}>Run request</Text>
        )}
      </Pressable>
    </View>
  );
}

/**
 * Post-login surface: varied HTTP hosts/methods so Mockifyer captures distinguishable traffic.
 */
export function DashboardScreen(): React.ReactElement {
  const { user, signOut } = useAppAuth();
  const { initialized, instance } = useMockifyerApp();
  const [log, setLog] = useState<string>('Tap a card to fetch. Responses also flow through Mockifyer.');

  if (!user) {
    return <View />;
  }

  const appendLog = useCallback((prefix: string, payload: unknown) => {
    const slice =
      typeof payload === 'string'
        ? payload.slice(0, 600)
        : JSON.stringify(payload, null, 2).slice(0, 600);
    setLog(`${prefix}\n${slice}${slice.length >= 600 ? '…' : ''}`);
  }, []);

  const runRandomUser = useCallback(async () => {
    const res = await fetch('https://randomuser.me/api/?nat=us&results=1');
    const json = (await res.json()) as unknown;
    appendLog(`randomuser.me (${res.status})`, json);
  }, [appendLog]);

  const runOpenMeteo = useCallback(async () => {
    const url =
      'https://api.open-meteo.com/v1/forecast?latitude=59.33&longitude=18.06&current_weather=true';
    const res = await fetch(url);
    const json = (await res.json()) as unknown;
    appendLog(`open-meteo (${res.status})`, json);
  }, [appendLog]);

  const runNationalize = useCallback(async () => {
    const res = await fetch('https://api.nationalize.io?name=alex');
    const json = (await res.json()) as unknown;
    appendLog(`nationalize.io (${res.status})`, json);
  }, [appendLog]);

  const runGitHubRepo = useCallback(async () => {
    const res = await fetch('https://api.github.com/repos/axios/axios', {
      headers: { Accept: 'application/vnd.github+json' },
    });
    const json = (await res.json()) as unknown;
    appendLog(`api.github.com (${res.status})`, json);
  }, [appendLog]);

  const runReqResPost = useCallback(async () => {
    const res = await fetch('https://reqres.in/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mockifyer Demo',
        job: 'recording HTTP',
      }),
    });
    const json = (await res.json()) as unknown;
    appendLog(`reqres.in POST (${res.status})`, json);
  }, [appendLog]);

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

      <Text style={styles.sectionLabel}>Sample APIs (different hosts / one POST)</Text>

      <ApiSnippet
        title="RandomUser — GET JSON"
        description="https://randomuser.me/api/"
        onPress={runRandomUser}
        disabled={!initialized}
      />
      <ApiSnippet
        title="Open-Meteo — GET query string"
        description="Forecast with latitude/longitude params"
        onPress={runOpenMeteo}
        disabled={!initialized}
      />
      <ApiSnippet
        title="Nationalize — GET JSON"
        description="https://api.nationalize.io?name=alex"
        onPress={runNationalize}
        disabled={!initialized}
      />
      <ApiSnippet
        title="GitHub REST — GET + Accept header"
        description="Public repo metadata (rate limits apply)"
        onPress={runGitHubRepo}
        disabled={!initialized}
      />
      <ApiSnippet
        title="ReqRes — POST JSON body"
        description="Illustrates POST body hashing in Mockifyer"
        onPress={runReqResPost}
        disabled={!initialized}
      />

      <Pressable
        style={styles.secondaryButton}
        onPress={() => void reloadMocks()}
        disabled={!initialized}
      >
        <Text style={styles.secondaryLabel}>Reload mocks (dev)</Text>
      </Pressable>

      <View style={styles.logBox}>
        <Text style={styles.logTitle}>Last response preview</Text>
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
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
