import React, { createContext, useContext } from 'react';
import type { MockifyerInstance } from '@sgedda/mockifyer-fetch';

export interface MockifyerAppContextValue {
  initialized: boolean;
  instance: MockifyerInstance | null;
}

const MockifyerAppContext = createContext<MockifyerAppContextValue>({
  initialized: false,
  instance: null,
});

export function MockifyerAppProvider(props: {
  value: MockifyerAppContextValue;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <MockifyerAppContext.Provider value={props.value}>{props.children}</MockifyerAppContext.Provider>
  );
}

export function useMockifyerApp(): MockifyerAppContextValue {
  return useContext(MockifyerAppContext);
}
