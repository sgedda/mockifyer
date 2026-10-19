/**
 * Example: runtimeMode: 'manual' - Clean API for Start Disabled
 * 
 * This demonstrates the new cleaner API using `runtimeMode: 'manual'`
 * instead of `startDisabled: true`. Both work the same way, but
 * `runtimeMode: 'manual'` is more explicit and preferred.
 * 
 * Perfect for apps that primarily use real APIs and only occasionally
 * need mocking via a GUI toggle.
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
        // NEW: Use runtimeMode: 'manual' for cleaner API
        const result = await setupMockifyerForReactNative({
          isDev: __DEV__,
          mockDataPath: 'mock-data',
          bundledDataPath: './assets/mock-data',
          runtimeMode: 'manual', // 👈 Cleaner than startDisabled: true
        });

        if (isMockifyerReactNativeActive(result)) {
          setMockifyerInstance(result.instance);
          console.log('✓ Mockifyer initialized in MANUAL mode');
          console.log('  (disabled by default, enable via toggle)');
        }
      } catch (error) {
        console.error('Failed to initialize Mockifyer:', error);
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
      <Header />
      <ComparisonCard />
      <ToggleControl mockifyerInstance={mockifyerInstance} />
      <ApiTester mockifyerInstance={mockifyerInstance} />
    </ScrollView>
  );
}

function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.headerText}>Manual Mode Demo</Text>
      <Text style={styles.headerSubtext}>runtimeMode: 'manual'</Text>
    </View>
  );
}

function ComparisonCard() {
  return (
    <View style={[styles.card, styles.comparisonCard]}>
      <Text style={styles.cardTitle}>📝 API Comparison</Text>
      
      <View style={styles.comparisonSection}>
        <Text style={styles.comparisonLabel}>Old Way (Still Works):</Text>
        <View style={styles.codeBlock}>
          <Text style={styles.codeText}>startDisabled: true</Text>
        </View>
      </View>

      <View style={styles.comparisonSection}>
        <Text style={styles.comparisonLabel}>New Way (Preferred):</Text>
        <View style={[styles.codeBlock, styles.codeBlockHighlight]}>
          <Text style={styles.codeText}>runtimeMode: 'manual'</Text>
        </View>
      </View>

      <Text style={styles.comparisonNote}>
        Both work the same way. The new API is clearer: "manual" mode means
        you'll manually enable it via a toggle.
      </Text>
    </View>
  );
}

function ToggleControl({ mockifyerInstance }: { mockifyerInstance: MockifyerInstance }) {
  const [isEnabled, setIsEnabled] = useState(() => mockifyerInstance.isMockifyerEnabled());

  const handleToggle = (value: boolean) => {
    if (value) {
      mockifyerInstance.enableMockifyer();
      console.log('🟢 Mockifyer enabled manually');
    } else {
      mockifyerInstance.disableMockifyer();
      console.log('🔴 Mockifyer disabled');
    }
    setIsEnabled(value);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Control Panel</Text>

      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleLabel}>Mockifyer</Text>
          <Text style={styles.toggleDescription}>
            {isEnabled ? 'Active (using mocks)' : 'Disabled (real APIs)'}
          </Text>
        </View>
        <Switch
          value={isEnabled}
          onValueChange={handleToggle}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={isEnabled ? '#007AFF' : '#f4f3f4'}
        />
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.statusDot, isEnabled && styles.statusDotActive]} />
        <Text style={styles.statusText}>
          {isEnabled ? 'Using mocks/dashboard/Redis' : 'Direct API calls only'}
        </Text>
      </View>
    </View>
  );
}

function ApiTester({ mockifyerInstance }: { mockifyerInstance: MockifyerInstance }) {
  const [result, setResult] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);

  const testApi = async () => {
    setIsTesting(true);
    try {
      const isEnabled = mockifyerInstance.isMockifyerEnabled();
      const startTime = Date.now();
      
      const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
      const duration = Date.now() - startTime;
      const data = await response.json();
      const wasMocked = response.headers.get('x-mockifyer') === 'true';

      setResult(
        `Mode: ${isEnabled ? 'ENABLED' : 'DISABLED'}\n` +
        `Duration: ${duration}ms\n` +
        `Mocked: ${wasMocked ? 'Yes ✓' : 'No ✗'}\n` +
        `Title: ${data.title?.substring(0, 50)}...`
      );
    } catch (error) {
      setResult(`Error: ${error}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>API Test</Text>
      <Text style={styles.description}>
        Test to see the difference between enabled (mocked) and disabled (real API).
      </Text>

      <Button
        title={isTesting ? 'Testing...' : 'Make API Request'}
        onPress={testApi}
        disabled={isTesting}
      />

      {result ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      ) : null}
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
    backgroundColor: '#34C759',
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
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
    fontFamily: 'monospace',
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
  comparisonCard: {
    backgroundColor: '#F0F9FF',
    borderLeftWidth: 4,
    borderLeftColor: '#0EA5E9',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#000',
  },
  comparisonSection: {
    marginBottom: 16,
  },
  comparisonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  codeBlock: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#E5E7EB',
  },
  codeBlockHighlight: {
    backgroundColor: '#DCFCE7',
    borderLeftColor: '#34C759',
  },
  codeText: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: '#1F2937',
  },
  comparisonNote: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 20,
    marginTop: 8,
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  statusDotActive: {
    backgroundColor: '#34C759',
  },
  statusText: {
    fontSize: 13,
    color: '#666',
  },
  description: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  resultBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  resultText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
    lineHeight: 18,
  },
});
