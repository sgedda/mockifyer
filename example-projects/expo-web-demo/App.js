import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Button, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import frankfurterRates from './frankfurter-rates.json';

export default function App() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initialize mockifyer on mount
    try {
      const mockifyer = setupMockifyer({
        mockDataPath: './fixtures',
        databaseProvider: {
          type: 'memory',
          options: {
            fixtures: [frankfurterRates]
          }
        },
        recordMode: false,
        failOnMissingMock: true,
        useGlobalFetch: true
      });
      console.log('[Expo Demo] Mockifyer initialized');
    } catch (err) {
      console.error('[Expo Demo] Initialization error:', err);
      setError(`Init error: ${err.message}`);
    }
  }, []);

  const testSeededReplay = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      console.log('[Expo Demo] Fetching seeded mock...');
      const response = await fetch('https://api.frankfurter.dev/v1/latest');
      const data = await response.json();
      console.log('[Expo Demo] Response:', data);
      
      setResult({
        success: true,
        base: data.base,
        ratesCount: Object.keys(data.rates || {}).length,
        date: data.date
      });
    } catch (err) {
      console.error('[Expo Demo] Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testMissingMock = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      console.log('[Expo Demo] Testing missing mock...');
      const response = await fetch('https://api.frankfurter.dev/v1/currencies');
      const data = await response.json();
      console.log('[Expo Demo] Unexpected success:', data);
      setError('Should have thrown an error for missing mock');
    } catch (err) {
      console.log('[Expo Demo] Expected error:', err.message);
      setResult({
        success: true,
        errorCaught: true,
        message: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mockifyer Expo Web Demo</Text>
      <StatusBar style="auto" />
      
      <View style={styles.buttonContainer}>
        <Button 
          title="Test Seeded Replay" 
          onPress={testSeededReplay}
          disabled={loading}
        />
        <Button 
          title="Test Missing Mock" 
          onPress={testMissingMock}
          disabled={loading}
        />
      </View>

      {loading && <Text style={styles.status}>Loading...</Text>}
      
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Error: {error}</Text>
        </View>
      )}
      
      {result && (
        <ScrollView style={styles.resultBox}>
          <Text style={styles.resultText}>{JSON.stringify(result, null, 2)}</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  status: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  errorBox: {
    backgroundColor: '#fee',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    marginTop: 10,
  },
  errorText: {
    color: '#c00',
    fontSize: 14,
  },
  resultBox: {
    backgroundColor: '#efe',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    maxHeight: 300,
    marginTop: 10,
  },
  resultText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
