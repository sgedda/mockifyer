/**
 * Example: Start Mockifyer DISABLED by Default
 * 
 * This demonstrates how to initialize Mockifyer in a disabled state,
 * then enable it via a GUI button when needed. Perfect for:
 * - Apps that usually use real APIs
 * - Development builds where mocking is optional
 * - Testing both mocked and real API behavior
 * 
 * Usage:
 * ```tsx
 * import { App } from './react-native-start-disabled';
 * 
 * export default App;
 * ```
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Button,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  setupMockifyerForReactNative,
  isMockifyerReactNativeActive,
  type MockifyerInstance,
} from '@sgedda/mockifyer-fetch';

export default function App() {
  const [mockifyerInstance, setMockifyerInstance] = useState<MockifyerInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initMockifyer() {
      try {
        // KEY: Set startDisabled: true to start with Mockifyer OFF
        const result = await setupMockifyerForReactNative({
          isDev: __DEV__,
          mockDataPath: 'mock-data',
          bundledDataPath: './assets/mock-data',
          recordMode: false,
          startDisabled: true, // 👈 Starts disabled!
        });

        if (isMockifyerReactNativeActive(result)) {
          setMockifyerInstance(result.instance);
          console.log('✓ Mockifyer initialized (DISABLED by default)');
          console.log('  Use the toggle to enable it when needed');
        } else {
          Alert.alert('Info', 'Mockifyer did not activate');
        }
      } catch (error) {
        Alert.alert('Error', `Failed to initialize Mockifyer: ${error}`);
      } finally {
        setIsLoading(false);
      }
    }

    initMockifyer();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Initializing...</Text>
      </View>
    );
  }

  if (!mockifyerInstance) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Mockifyer not available</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Start Disabled Demo</Text>
        <Text style={styles.headerSubtext}>Mockifyer is OFF by default</Text>
      </View>

      <InfoCard />
      <MockifyerToggle mockifyerInstance={mockifyerInstance} />
      <ApiTestSection mockifyerInstance={mockifyerInstance} />
    </ScrollView>
  );
}

function InfoCard() {
  return (
    <View style={[styles.card, styles.infoCard]}>
      <Text style={styles.infoTitle}>ℹ️ How This Works</Text>
      <Text style={styles.infoText}>
        This app started with{' '}
        <Text style={styles.code}>startDisabled: true</Text>
      </Text>
      <Text style={styles.infoText}>
        • All requests currently go to <Text style={styles.bold}>real APIs</Text>
      </Text>
      <Text style={styles.infoText}>
        • No dashboard or Redis connections
      </Text>
      <Text style={styles.infoText}>
        • Toggle the switch below to enable mocking
      </Text>
    </View>
  );
}

function MockifyerToggle({ mockifyerInstance }: { mockifyerInstance: MockifyerInstance }) {
  const [isEnabled, setIsEnabled] = useState(() => mockifyerInstance.isMockifyerEnabled());

  const handleToggle = (value: boolean) => {
    if (value) {
      mockifyerInstance.enableMockifyer();
      console.log('🟢 Mockifyer ENABLED - Now using mocks/dashboard/Redis');
      Alert.alert(
        'Mockifyer Enabled',
        'Requests will now use mocked responses and connect to dashboard/Redis'
      );
    } else {
      mockifyerInstance.disableMockifyer();
      console.log('🔴 Mockifyer DISABLED - Back to real API calls');
      Alert.alert(
        'Mockifyer Disabled',
        'Requests will go directly to real APIs (no mocking)'
      );
    }
    setIsEnabled(value);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Mockifyer Control</Text>

      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleLabel}>Enable Mocking</Text>
          <Text style={styles.toggleDescription}>
            {isEnabled
              ? 'Using mocks, dashboard, and Redis'
              : 'Using real APIs (no mocking)'}
          </Text>
        </View>
        <Switch
          value={isEnabled}
          onValueChange={handleToggle}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={isEnabled ? '#007AFF' : '#f4f3f4'}
        />
      </View>

      <View style={[styles.statusBadge, !isEnabled && styles.statusBadgeInactive]}>
        <Text
          style={[
            styles.statusText,
            { color: isEnabled ? '#34C759' : '#FF3B30' },
          ]}
        >
          {isEnabled ? '● MOCKING ACTIVE' : '● REAL API MODE'}
        </Text>
      </View>
    </View>
  );
}

function ApiTestSection({ mockifyerInstance }: { mockifyerInstance: MockifyerInstance }) {
  const [requestLog, setRequestLog] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const testApi = async () => {
    setIsTesting(true);
    const mockifyerStatus = mockifyerInstance.isMockifyerEnabled() ? 'ENABLED' : 'DISABLED';

    try {
      const startTime = Date.now();
      const response = await fetch('https://jsonplaceholder.typicode.com/todos/1');
      const duration = Date.now() - startTime;
      const data = await response.json();
      const wasMocked = response.headers.get('x-mockifyer') === 'true';

      const logEntry =
        `[${new Date().toLocaleTimeString()}] ${mockifyerStatus}\n` +
        `  Status: ${response.status} | Duration: ${duration}ms\n` +
        `  Mocked: ${wasMocked ? 'Yes ✓' : 'No ✗'}\n` +
        `  Title: ${data.title?.substring(0, 40)}...`;

      setRequestLog((prev) => [logEntry, ...prev].slice(0, 5));
    } catch (error) {
      const logEntry = `[${new Date().toLocaleTimeString()}] ${mockifyerStatus}\n  ✗ Error: ${error}`;
      setRequestLog((prev) => [logEntry, ...prev].slice(0, 5));
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Test API Request</Text>
      <Text style={styles.description}>
        Test requests to see the difference between mocked and real API responses.
        The log shows whether each request was mocked.
      </Text>

      <Button
        title={isTesting ? 'Testing...' : 'Make API Request'}
        onPress={testApi}
        disabled={isTesting}
      />

      {requestLog.length > 0 && (
        <View style={styles.logContainer}>
          <Text style={styles.logTitle}>Request Log (last 5):</Text>
          {requestLog.map((log, index) => (
            <View key={index} style={styles.logEntry}>
              <Text style={styles.logText}>{log}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
  },
  header: {
    backgroundColor: '#5856D6',
    padding: 20,
    paddingTop: 60,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  card: {
    backgroundColor: 'white',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoCard: {
    backgroundColor: '#E8F4FD',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#000',
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
  code: {
    fontFamily: 'monospace',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  bold: {
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#000',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 13,
    color: '#666',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeInactive: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  logContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  logTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  logEntry: {
    padding: 8,
    backgroundColor: 'white',
    borderRadius: 4,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  logText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#333',
    lineHeight: 16,
  },
});
