import { Platform } from 'react-native';

export type MockifyerBackend = 'hybrid' | 'redis';

export function readEnv(key: string): string | undefined {
  if (typeof process === 'undefined' || !process.env) {
    return undefined;
  }
  const value = process.env[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

export function defaultDashboardOrigin(): string {
  return Platform.OS === 'android' ? 'http://10.0.2.2:3002' : 'http://localhost:3002';
}

export function resolveDashboardBaseUrl(): string {
  return (
    readEnv('EXPO_PUBLIC_MOCKIFYER_PROXY_URL') ??
    readEnv('EXPO_PUBLIC_MOCKIFYER_DASHBOARD_URL') ??
    defaultDashboardOrigin()
  );
}

export function resolveMetroOrigin(): string {
  const port = readEnv('METRO_PORT') ?? '8081';
  return Platform.OS === 'android' ? `http://10.0.2.2:${port}` : `http://localhost:${port}`;
}

export function resolveDefaultClientId(): string {
  return (
    readEnv('EXPO_PUBLIC_MOCKIFYER_CLIENT_ID') ??
    readEnv('MOCKIFYER_CLIENT_ID') ??
    'wanderweird-demo'
  );
}

export function resolveBackend(): MockifyerBackend {
  const raw = readEnv('EXPO_PUBLIC_MOCKIFYER_BACKEND')?.toLowerCase();
  if (raw === 'redis' || raw === 'proxy' || raw === 'dashboard') {
    return 'redis';
  }
  return 'hybrid';
}
