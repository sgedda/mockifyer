/**
 * Example: Runtime Mockifyer Toggle Component for React Native
 * 
 * This component demonstrates how to toggle Mockifyer on/off at runtime
 * in a React Native application. When disabled, all requests bypass
 * Mockifyer completely (no dashboard, Redis, proxy, or mock lookup).
 * 
 * Usage:
 * ```tsx
 * import { MockifyerToggle } from './MockifyerToggle';
 * 
 * function App() {
 *   return (
 *     <View>
 *       <MockifyerToggle />
 *       {/* Your app content *\/}
 *     </View>
 *   );
 * }
 * ```
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, Platform } from 'react-native';
import type { MockifyerInstance } from '@sgedda/mockifyer-fetch';

interface MockifyerToggleProps {
  /** The Mockifyer instance returned from setupMockifyerForReactNative */
  mockifyerInstance: MockifyerInstance;
  /** Optional label for the toggle */
  label?: string;
  /** Optional callback when toggle state changes */
  onToggle?: (enabled: boolean) => void;
}

export function MockifyerToggle({ 
  mockifyerInstance, 
  label = 'Enable Mockifyer',
  onToggle 
}: MockifyerToggleProps) {
  const [isEnabled, setIsEnabled] = useState(() => 
    mockifyerInstance.isMockifyerEnabled()
  );

  const handleToggle = (value: boolean) => {
    if (value) {
      mockifyerInstance.enableMockifyer();
    } else {
      mockifyerInstance.disableMockifyer();
    }
    setIsEnabled(value);
    onToggle?.(value);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={isEnabled}
        onValueChange={handleToggle}
        trackColor={{ false: '#767577', true: '#81b0ff' }}
        thumbColor={isEnabled ? '#007AFF' : '#f4f3f4'}
        ios_backgroundColor="#3e3e3e"
      />
      <Text style={styles.status}>
        {isEnabled ? '✓ Active' : '✗ Bypassed'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  status: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
    minWidth: 80,
  },
});

/**
 * Hook version for more flexible integration
 * 
 * @example
 * ```tsx
 * function MyScreen() {
 *   const { isEnabled, toggle, enable, disable } = useMockifyerToggle(mockifyerInstance);
 *   
 *   return (
 *     <Button 
 *       title={isEnabled ? "Disable Mockifyer" : "Enable Mockifyer"}
 *       onPress={toggle}
 *     />
 *   );
 * }
 * ```
 */
export function useMockifyerToggle(mockifyerInstance: MockifyerInstance) {
  const [isEnabled, setIsEnabled] = useState(() => 
    mockifyerInstance.isMockifyerEnabled()
  );

  const enable = () => {
    mockifyerInstance.enableMockifyer();
    setIsEnabled(true);
  };

  const disable = () => {
    mockifyerInstance.disableMockifyer();
    setIsEnabled(false);
  };

  const toggle = () => {
    if (isEnabled) {
      disable();
    } else {
      enable();
    }
  };

  return {
    isEnabled,
    enable,
    disable,
    toggle,
  };
}

/**
 * Complete example with app integration
 * 
 * @example
 * ```tsx
 * import React, { useEffect, useState } from 'react';
 * import { View, Button, Text } from 'react-native';
 * import { setupMockifyerForReactNative, isMockifyerReactNativeActive } from '@sgedda/mockifyer-fetch';
 * import { MockifyerToggle, useMockifyerToggle } from './MockifyerToggle';
 * 
 * function App() {
 *   const [mockifyerResult, setMockifyerResult] = useState(null);
 *   
 *   useEffect(() => {
 *     async function init() {
 *       const result = await setupMockifyerForReactNative({
 *         isDev: __DEV__,
 *         mockDataPath: 'mock-data',
 *         bundledDataPath: './assets/mock-data',
 *       });
 *       setMockifyerResult(result);
 *     }
 *     init();
 *   }, []);
 *   
 *   if (!mockifyerResult || !isMockifyerReactNativeActive(mockifyerResult)) {
 *     return <Text>Loading...</Text>;
 *   }
 *   
 *   return (
 *     <View style={{ flex: 1 }}>
 *       <MockifyerToggle 
 *         mockifyerInstance={mockifyerResult.instance}
 *         onToggle={(enabled) => {
 *           console.log('Mockifyer is now:', enabled ? 'ACTIVE' : 'BYPASSED');
 *         }}
 *       />
 *       
 *       {/* Your app content *\/}
 *       <MyContent mockifyerInstance={mockifyerResult.instance} />
 *     </View>
 *   );
 * }
 * 
 * function MyContent({ mockifyerInstance }) {
 *   const { isEnabled, toggle } = useMockifyerToggle(mockifyerInstance);
 *   
 *   const makeRequest = async () => {
 *     // This request will be:
 *     // - Mocked/proxied if Mockifyer is enabled
 *     // - Direct to API if Mockifyer is disabled
 *     const response = await fetch('https://api.example.com/data');
 *     console.log('Response:', response);
 *   };
 *   
 *   return (
 *     <View style={{ padding: 20 }}>
 *       <Text>Mockifyer Status: {isEnabled ? 'Active' : 'Bypassed'}</Text>
 *       <Button title="Toggle Mockifyer" onPress={toggle} />
 *       <Button title="Make API Request" onPress={makeRequest} />
 *     </View>
 *   );
 * }
 * ```
 */
