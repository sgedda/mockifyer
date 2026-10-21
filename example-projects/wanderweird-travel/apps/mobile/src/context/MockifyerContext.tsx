import React, { createContext, useContext } from 'react';
import type {
  MockifyerInstance,
  SetupMockifyerForReactNativeResult,
} from '@sgedda/mockifyer-fetch/react-native';
import type { MockifyerBackend } from '../dev/mockifyer-env';

export interface MockifyerAppContextValue {
  ready: boolean;
  status: SetupMockifyerForReactNativeResult['status'] | 'pending';
  instance: MockifyerInstance | null;
  backend: MockifyerBackend;
  dashboardBaseUrl: string;
  clientId: string;
}

const MockifyerAppContext = createContext<MockifyerAppContextValue>({
  ready: false,
  status: 'pending',
  instance: null,
  backend: 'hybrid',
  dashboardBaseUrl: 'http://localhost:3002',
  clientId: 'wanderweird-demo',
});

export function MockifyerAppProvider({
  value,
  children,
}: {
  value: MockifyerAppContextValue;
  children: React.ReactNode;
}) {
  return (
    <MockifyerAppContext.Provider value={value}>{children}</MockifyerAppContext.Provider>
  );
}

export function useMockifyerApp(): MockifyerAppContextValue {
  return useContext(MockifyerAppContext);
}
