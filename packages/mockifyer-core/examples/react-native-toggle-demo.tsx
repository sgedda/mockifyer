/**
 * Complete working example: Runtime Mockifyer Toggle in React Native
 * 
 * This demonstrates the complete integration of the runtime toggle feature.
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

// Main App Component
export default function App() {
  const [mockifyerInstance, setMockifyerInstance] = useState<MockifyerInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initMockifyer() {
      try {
        const result = await setupMockifyerForReactNative({
          isDev: __DEV__,
          mockDataPath: 'mock-data',
          bundledDataPath: './assets/mock-data',
          recordMode: false,
        });

        if (isMockifyerReactNativeActive(result)) {
          setMockifyerInstance(result.instance);
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
        <Text style={styles.headerText}>Mockifyer Runtime Toggle Demo</Text>
      </View>

      <MockifyerControls mockifyerInstance={mockifyerInstance} />
      <ApiTestSection mockifyerInstance={mockifyerInstance} />
    </ScrollView>
  );
}

// Toggle Controls Component
function MockifyerControls({ mockifyerInstance }: { mockifyerInstance: MockifyerInstance }) {
  const [isEnabled, setIsEnabled] = useState(() => mockifyerInstance.isMockifyerEnabled());

  const handleToggle = (value: boolean) => {
    if (value) {
      mockifyerInstance.enableMockifyer();
      console.log('✅ Mockifyer ENABLED - Using mocks/dashboard/Redis');
    } else {
      mockifyerInstance.disableMockifyer();
      console.log('🔴 Mockifyer DISABLED - Direct API calls only');
    }
    setIsEnabled(value);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Mockifyer Control</Text>
      
      <View style={styles.toggleRow}>
        <View style={styles.toggleInfo}>
          <Text style={styles.toggleLabel}>Mockifyer Status</Text>
          <Text style={styles.toggleDescription}>
            {isEnabled 
              ? 'Active - Using mocks, dashboard, and Redis' 
              : 'Bypassed - Direct API calls only'}
          </Text>
        </View>
        <Switch
          value={isEnabled}
          onValueChange={handleToggle}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={isEnabled ? '#007AFF' : '#f4f3f4'}
        />
      </View>

      <View style={styles.statusBadge}>
        <Text style={[styles.statusText, { color: isEnabled ? '#34C759' : '#FF3B30' }]}>
          {isEnabled ? '● ACTIVE' : '● BYPASSED'}
        </Text>
      </View>
    </View>
  );
}

// API Test Section
function ApiTestSection({ mockifyerInstance }: { mockifyerInstance: MockifyerInstance }) {
  const [lastRequestStatus, setLastRequestStatus] = useState<string>('');
  const [isTesting, setIsTesting] = useState(false);

  const testApi = async () => {
    setIsTesting(true);
    setLastRequestStatus('Making request...');

    try {
      const mockifyerStatus = mockifyerInstance.isMockifyerEnabled() ? 'ENABLED' : 'DISABLED';
      
      // This request will be:
      // - Intercepted by Mockifyer if enabled (mock hit or proxy)
      // - Direct to API if disabled
      const response = await fetch('https://jsonplaceholder.typicode.com/todos/1');
      const data = await response.json();

      const wasMocked = response.headers.get('x-mockifyer') === 'true';
      
      setLastRequestStatus(
        `✓ Request completed\n` +
        `Mockifyer: ${mockifyerStatus}\n` +
        `Was mocked: ${wasMocked ? 'Yes' : 'No'}\n` +
        `Status: ${response.status}\n` +
        `Data: ${JSON.stringify(data).substring(0, 100)}...`
      );
    } catch (error) {
      setLastRequestStatus(`✗ Request failed: ${error}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Test API Request</Text>
      <Text style={styles.description}>
        Test how Mockifyer affects API requests. When enabled, requests may use
        mocked responses or go through the dashboard/Redis. When disabled, all
        requests go directly to the API.
      </Text>

      <Button
        title={isTesting ? 'Testing...' : 'Test API Request'}
        onPress={testApi}
        disabled={isTesting}
      />

      {lastRequestStatus ? (
        <View style={styles.resultBox}>
          <Text style={styles.resultText}>{lastRequestStatus}</Text>
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
    backgroundColor: '#007AFF',
    padding: 20,
    paddingTop: 60,
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
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
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
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
  resultBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  resultText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#333',
  },
});
