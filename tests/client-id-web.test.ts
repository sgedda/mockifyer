/**
 * Tests for web-specific client ID resolution.
 * Requires mocking browser APIs: window.location, localStorage
 */

import type { MockifyerConfig } from '@sgedda/mockifyer-core';

// Import the web variant directly by specifying the full path
// This bypasses Metro resolution and tests the web implementation
const clientIdWeb = require('../packages/mockifyer-core/src/utils/client-id.web.ts');
const { resolveClientId, resolveExplicitClientIdOnly, saveClientIdToLocalStorage } = clientIdWeb;

describe('client-id.web', () => {
  const baseConfig: MockifyerConfig = {
    mockDataPath: './mock-data',
    recordMode: false,
  };

  const originalEnv = process.env;
  const originalWindow = global.window;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.MOCKIFYER_CLIENT_ID;
    delete process.env.EXPO_PUBLIC_MOCKIFYER_CLIENT_ID;
    delete process.env.MOCKIFYER_CLIENT_LANE;
    
    // Mock window.location and localStorage
    const mockLocalStorage: Record<string, string> = {};
    (global as any).window = {
      location: {
        search: '',
      },
      localStorage: {
        getItem: (key: string) => mockLocalStorage[key] || null,
        setItem: (key: string, value: string) => {
          mockLocalStorage[key] = value;
        },
        removeItem: (key: string) => {
          delete mockLocalStorage[key];
        },
      },
    };
  });

  afterAll(() => {
    process.env = originalEnv;
    global.window = originalWindow;
  });

  it('uses MOCKIFYER_CLIENT_ID when set', () => {
    process.env.MOCKIFYER_CLIENT_ID = 'lane-explicit';
    const id = resolveClientId(baseConfig);
    expect(id).toBe('lane-explicit');
  });

  it('uses EXPO_PUBLIC_MOCKIFYER_CLIENT_ID from Expo public env var', () => {
    process.env.EXPO_PUBLIC_MOCKIFYER_CLIENT_ID = 'expo-web-lane';
    const id = resolveClientId(baseConfig);
    expect(id).toBe('expo-web-lane');
  });

  it('MOCKIFYER_CLIENT_ID takes precedence over EXPO_PUBLIC_MOCKIFYER_CLIENT_ID', () => {
    process.env.MOCKIFYER_CLIENT_ID = 'lane-explicit';
    process.env.EXPO_PUBLIC_MOCKIFYER_CLIENT_ID = 'expo-web-lane';
    const id = resolveClientId(baseConfig);
    expect(id).toBe('lane-explicit');
  });

  it('uses URL query parameter ?mockifyerClientId=...', () => {
    (global.window as any).location.search = '?mockifyerClientId=url-lane';
    const id = resolveClientId(baseConfig);
    expect(id).toBe('url-lane');
  });

  it('URL parameter takes precedence over config.clientId', () => {
    (global.window as any).location.search = '?mockifyerClientId=url-lane';
    const id = resolveClientId({ ...baseConfig, clientId: 'lane-config' });
    expect(id).toBe('url-lane');
  });

  it('EXPO_PUBLIC_MOCKIFYER_CLIENT_ID takes precedence over URL parameter', () => {
    process.env.EXPO_PUBLIC_MOCKIFYER_CLIENT_ID = 'expo-web-lane';
    (global.window as any).location.search = '?mockifyerClientId=url-lane';
    const id = resolveClientId(baseConfig);
    expect(id).toBe('expo-web-lane');
  });

  it('uses localStorage when URL param and env are not set', () => {
    (global.window as any).localStorage.setItem('mockifyer-client-id', 'stored-lane');
    const id = resolveClientId(baseConfig);
    expect(id).toBe('stored-lane');
  });

  it('URL parameter takes precedence over localStorage', () => {
    (global.window as any).localStorage.setItem('mockifyer-client-id', 'stored-lane');
    (global.window as any).location.search = '?mockifyerClientId=url-lane';
    const id = resolveClientId(baseConfig);
    expect(id).toBe('url-lane');
  });

  it('persists URL parameter to localStorage', () => {
    (global.window as any).location.search = '?mockifyerClientId=url-lane';
    const id = resolveClientId(baseConfig);
    expect(id).toBe('url-lane');
    expect((global.window as any).localStorage.getItem('mockifyer-client-id')).toBe('url-lane');
  });

  it('falls back to config.clientId when no web sources are set', () => {
    const id = resolveClientId({ ...baseConfig, clientId: 'lane-config' });
    expect(id).toBe('lane-config');
  });

  it('falls back to build metadata when no explicit sources', () => {
    process.env.MOCKIFYER_APPLICATION_ID = 'wanderweird';
    process.env.MOCKIFYER_MARKET = 'prod';
    process.env.MOCKIFYER_VERSION_NAME = '1.0.0';
    process.env.MOCKIFYER_VERSION_CODE = '1';
    const id = resolveClientId(baseConfig);
    expect(id).toBe('wanderweird-prod-1.0.0-1');
  });

  it('saveClientIdToLocalStorage stores the client ID', () => {
    saveClientIdToLocalStorage('test-lane');
    expect((global.window as any).localStorage.getItem('mockifyer-client-id')).toBe('test-lane');
  });

  it('resolveExplicitClientIdOnly returns undefined when no explicit sources', () => {
    const id = resolveExplicitClientIdOnly(baseConfig);
    expect(id).toBeUndefined();
  });

  it('resolveExplicitClientIdOnly uses URL parameter', () => {
    (global.window as any).location.search = '?mockifyerClientId=url-lane';
    const id = resolveExplicitClientIdOnly(baseConfig);
    expect(id).toBe('url-lane');
  });
});
