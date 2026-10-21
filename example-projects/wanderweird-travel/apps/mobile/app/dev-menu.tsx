import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BrandMark, Button, Screen, Subtitle, Title } from '../src/components/ui';
import { useMockifyerApp } from '../src/context/MockifyerContext';
import {
  createScenario,
  loadDateSnapshot,
  loadScenarioSnapshot,
  selectScenario,
  setClientDate,
  setScenarioDate,
  toIsoFixedDate,
  type DateSnapshot,
  type ScenarioSnapshot,
} from '../src/dev/mockifyer-control';
import {
  applyRecordBodiesToInstance,
  applyRecordModeToInstance,
  getCachedRecordBodiesPreference,
  getCachedRecordModePreference,
  loadRecordBodiesPreference,
  loadRecordModePreference,
  saveRecordBodiesPreference,
  saveRecordModePreference,
} from '../src/dev/recording-preferences';
import { colors, radii, spacing } from '../src/theme/tokens';

type DateScope = 'scenario' | 'client';

export default function DevMenuScreen() {
  const router = useRouter();
  const { instance, backend, dashboardBaseUrl, clientId, status } = useMockifyerApp();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [snapshot, setSnapshot] = useState<ScenarioSnapshot | null>(null);
  const [dates, setDates] = useState<DateSnapshot | null>(null);
  const [selectedScenario, setSelectedScenario] = useState('');
  const [newScenario, setNewScenario] = useState('');
  const [deriveFrom, setDeriveFrom] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [dateScope, setDateScope] = useState<DateScope>('scenario');
  const [laneClientId, setLaneClientId] = useState(clientId);
  const [recordMode, setRecordMode] = useState(
    () => getCachedRecordModePreference() ?? instance?.isRecordMode?.() === true
  );
  const [recordBodies, setRecordBodies] = useState(
    () => getCachedRecordBodiesPreference() ?? instance?.isRecordResponses?.() === true
  );
  const [mockifyerEnabled, setMockifyerEnabled] = useState(
    () => instance?.isMockifyerEnabled?.() !== false
  );

  // Restore persisted recording preferences onto the instance once it is ready.
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const preferredMode = await loadRecordModePreference();
      const preferredBodies = await loadRecordBodiesPreference();
      if (cancelled) {
        return;
      }
      applyRecordModeToInstance(instance, preferredMode);
      applyRecordBodiesToInstance(instance, preferredBodies);
      setRecordMode(preferredMode);
      setRecordBodies(preferredBodies);
    }
    void restore();
    return () => {
      cancelled = true;
    };
  }, [instance]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (instance) {
        // Prefer cached toggles (avoids an in-flight refresh overwriting a just-flipped switch).
        const preferredMode =
          getCachedRecordModePreference() ?? instance.isRecordMode?.() === true;
        const preferredBodies =
          getCachedRecordBodiesPreference() ?? instance.isRecordResponses?.() === true;
        applyRecordModeToInstance(instance, preferredMode);
        applyRecordBodiesToInstance(instance, preferredBodies);
        setRecordMode(instance.isRecordMode?.() === true);
        setRecordBodies(instance.isRecordResponses?.() === true);
        setMockifyerEnabled(instance.isMockifyerEnabled?.() !== false);
      }
      const scenarios = await loadScenarioSnapshot();
      setSnapshot(scenarios);
      setSelectedScenario(scenarios.currentScenario);
      const dateSnap = await loadDateSnapshot({
        scenario: scenarios.currentScenario,
        clientId: laneClientId,
      });
      setDates(dateSnap);
      const preferred =
        dateScope === 'client' && dateSnap.clientFixedDate
          ? dateSnap.clientFixedDate
          : dateSnap.fixedDate;
      setDateInput(preferred ? preferred.slice(0, 10) : '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Mockifyer state');
    } finally {
      setLoading(false);
    }
  }, [dateScope, instance, laneClientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function onToggleRecordMode(value: boolean) {
    if (!instance) {
      setError('Mockifyer is not active — cannot toggle record mode.');
      return;
    }
    // Cache first so any concurrent refresh picks up the new value.
    void saveRecordModePreference(value);
    applyRecordModeToInstance(instance, value);
    setRecordMode(value);
    setMessage(
      value
        ? recordBodies
          ? 'Record mode ON — saving request + response bodies.'
          : 'Record mode ON — saving request-only stubs (lighter; same as Redis default).'
        : 'Record mode OFF — replaying mocks only.'
    );
    setError(null);
  }

  function onToggleRecordBodies(value: boolean) {
    if (!instance) {
      setError('Mockifyer is not active — cannot toggle response recording.');
      return;
    }
    void saveRecordBodiesPreference(value);
    applyRecordBodiesToInstance(instance, value);
    setRecordBodies(value);
    setMessage(
      value
        ? 'Response bodies ON — fuller mocks, heavier I/O.'
        : 'Response bodies OFF — request-only stubs (responsePending).'
    );
    setError(null);
  }

  function onToggleMockifyer(value: boolean) {
    if (!instance) {
      setError('Mockifyer is not active — cannot toggle.');
      return;
    }
    if (value) {
      instance.enableMockifyer();
    } else {
      instance.disableMockifyer();
    }
    setMockifyerEnabled(value);
    setMessage(value ? 'Mockifyer enabled.' : 'Mockifyer bypassed — live HTTP only.');
    setError(null);
  }

  async function onSelectScenario(name: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await selectScenario({ scenario: name, instance });
      setMessage(`Scenario set to “${name}”.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set scenario');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateScenario() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const name = newScenario.trim();
      const created = await createScenario({
        scenario: name,
        deriveFrom: deriveFrom || null,
      });
      setSnapshot(created);
      setNewScenario('');
      await selectScenario({ scenario: name, instance });
      setMessage(`Created and activated “${name}”.`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scenario');
    } finally {
      setBusy(false);
    }
  }

  async function onApplyDate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const scenario = selectedScenario || snapshot?.currentScenario || 'default';
      const iso = toIsoFixedDate(dateInput);
      if (dateScope === 'scenario') {
        await setScenarioDate({ scenario, fixedDate: iso });
        setMessage(`Scenario date for “${scenario}” → ${iso.slice(0, 10)}`);
      } else {
        const result = await setClientDate({
          clientId: laneClientId,
          scenario,
          fixedDate: iso,
          instance,
        });
        setMessage(
          result.mode === 'lane'
            ? `Client lane “${laneClientId}” date → ${iso.slice(0, 10)}`
            : `Local client date for “${laneClientId}” → ${iso.slice(0, 10)} (dashboard lanes unavailable)`
        );
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set date');
    } finally {
      setBusy(false);
    }
  }

  async function onClearDate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const scenario = selectedScenario || snapshot?.currentScenario || 'default';
      if (dateScope === 'scenario') {
        await setScenarioDate({ scenario, fixedDate: null });
        setMessage(`Cleared scenario date for “${scenario}”.`);
      } else {
        const result = await setClientDate({
          clientId: laneClientId,
          scenario,
          fixedDate: null,
          instance,
        });
        setMessage(
          result.mode === 'lane'
            ? `Cleared client lane date for “${laneClientId}”.`
            : `Cleared local client date for “${laneClientId}”.`
        );
      }
      setDateInput('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear date');
    } finally {
      setBusy(false);
    }
  }

  if (!__DEV__) {
    return (
      <Screen>
        <Title>Dev menu</Title>
        <Subtitle>Only available in development builds.</Subtitle>
        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen style={{ paddingBottom: 0 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <BrandMark />
        <Title>{'Mockifyer\ndev menu'}</Title>
        <Subtitle>
          Backend {backend} · status {status} · dashboard {dashboardBaseUrl}
          {dates?.source ? ` · dates via ${dates.source}` : ''}
          {snapshot?.source ? ` · scenarios via ${snapshot.source}` : ''}
        </Subtitle>

        <Button label="Refresh" variant="ghost" onPress={() => void refresh()} disabled={busy || loading} />
        <Button label="Back" variant="ghost" onPress={() => router.back()} />

        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.seafoam} />
            <Text style={styles.hint}>Loading scenarios…</Text>
          </View>
        ) : null}

        <Text style={styles.section}>Runtime</Text>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchLabel}>Mockifyer enabled</Text>
            <Text style={styles.hint}>Off = bypass mocks/proxy (live HTTP).</Text>
          </View>
          <Switch
            value={mockifyerEnabled}
            onValueChange={onToggleMockifyer}
            disabled={!instance || busy}
            trackColor={{ true: colors.seafoam, false: colors.mist }}
          />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchLabel}>Record mode</Text>
            <Text style={styles.hint}>
              Manual — off by default. On = capture traffic into the active scenario
              {backend === 'redis' ? ' (via dashboard proxy)' : ' (hybrid → mock-data)'}
              . Use the app after toggling so traffic is captured.
            </Text>
          </View>
          <Switch
            value={recordMode}
            onValueChange={onToggleRecordMode}
            disabled={!instance || busy || !mockifyerEnabled}
            trackColor={{ true: colors.amber, false: colors.mist }}
          />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchLabel}>Record response bodies</Text>
            <Text style={styles.hint}>
              Off (default, like Redis) = request-only stubs (`responsePending`, live until
              you capture a body later). On = store full responses (heavier).
            </Text>
          </View>
          <Switch
            value={recordBodies}
            onValueChange={onToggleRecordBodies}
            disabled={!instance || busy || !mockifyerEnabled || !recordMode}
            trackColor={{ true: colors.coral, false: colors.mist }}
          />
        </View>

        <Text style={styles.section}>Active scenario</Text>
        <Text style={styles.hint}>
          Current: {snapshot?.currentScenario ?? '—'}
          {!mockifyerEnabled ? ' · Mockifyer bypassed' : ''}
          {recordMode
            ? recordBodies
              ? ' · recording bodies'
              : ' · recording requests only'
            : ' · replay only'}
        </Text>
        <View style={styles.chipWrap}>
          {(snapshot?.scenarios ?? []).map((name) => {
            const active = name === (selectedScenario || snapshot?.currentScenario);
            return (
              <Pressable
                key={name}
                disabled={busy}
                onPress={() => void onSelectScenario(name)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Create scenario</Text>
        <Text style={styles.hint}>Requires dashboard (`npm run dashboard` from wanderweird-travel).</Text>
        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={newScenario}
          onChangeText={setNewScenario}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="e.g. jetlag-friday"
          placeholderTextColor={colors.slate}
        />
        <Text style={styles.label}>Derive from (optional)</Text>
        <TextInput
          style={styles.input}
          value={deriveFrom}
          onChangeText={setDeriveFrom}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={snapshot?.currentScenario || 'default'}
          placeholderTextColor={colors.slate}
        />
        <Button
          label={busy ? 'Working…' : 'Create scenario'}
          onPress={() => void onCreateScenario()}
          disabled={busy || !newScenario.trim()}
        />

        <Text style={styles.section}>Mock date</Text>
        <Text style={styles.hint}>
          Effective now: {dates?.currentDate ? dates.currentDate.slice(0, 19) : '—'}
          {dates?.fixedDate ? ` · scenario fixed ${dates.fixedDate.slice(0, 10)}` : ''}
          {dates?.clientFixedDate
            ? ` · client fixed ${dates.clientFixedDate.slice(0, 10)}`
            : ''}
        </Text>

        <View style={styles.chaosRow}>
          <Button
            label="Scenario (global)"
            variant={dateScope === 'scenario' ? 'primary' : 'ghost'}
            onPress={() => setDateScope('scenario')}
          />
          <Button
            label="Client lane"
            variant={dateScope === 'client' ? 'primary' : 'ghost'}
            onPress={() => setDateScope('client')}
          />
        </View>

        {dateScope === 'client' ? (
          <>
            <Text style={styles.label}>Client id</Text>
            <TextInput
              style={styles.input}
              value={laneClientId}
              onChangeText={setLaneClientId}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.hint}>
              {dates?.clientLanesEnabled
                ? 'Redis/sqlite lanes enabled — date overrides scenario date for this lane.'
                : 'Lanes unavailable (filesystem/hybrid) — date applies locally in this app process.'}
            </Text>
          </>
        ) : (
          <Text style={styles.hint}>
            Writes date-config for scenario “{selectedScenario || snapshot?.currentScenario}”.
          </Text>
        )}

        <Text style={styles.label}>Fixed date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={dateInput}
          onChangeText={setDateInput}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="2026-10-08"
          placeholderTextColor={colors.slate}
        />
        <Button
          label={busy ? 'Working…' : 'Apply date'}
          onPress={() => void onApplyDate()}
          disabled={busy || !dateInput.trim()}
        />
        <Button
          label="Clear date"
          variant="ghost"
          onPress={() => void onClearDate()}
          disabled={busy}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.ok}>{message}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  section: {
    fontFamily: 'Syne_700Bold',
    color: colors.amber,
    marginTop: spacing.md,
    fontSize: 18,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    color: colors.slate,
    marginTop: spacing.sm,
  },
  hint: {
    fontFamily: 'DMSans_400Regular',
    color: colors.slate,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(232,244,242,0.14)',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.foam,
    fontFamily: 'DMSans_400Regular',
    fontSize: 16,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(232,244,242,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  chipActive: {
    borderColor: colors.seafoam,
    backgroundColor: 'rgba(61,220,151,0.16)',
  },
  chipLabel: {
    fontFamily: 'DMSans_500Medium',
    color: colors.foam,
  },
  chipLabelActive: {
    color: colors.seafoam,
  },
  chaosRow: {
    gap: spacing.sm,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 4,
  },
  switchCopy: {
    flex: 1,
    gap: 4,
  },
  switchLabel: {
    fontFamily: 'DMSans_500Medium',
    color: colors.foam,
    fontSize: 16,
  },
  error: {
    color: colors.danger,
    fontFamily: 'DMSans_500Medium',
  },
  ok: {
    color: colors.seafoam,
    fontFamily: 'DMSans_500Medium',
  },
});
