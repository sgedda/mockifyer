/**
 * Test that architecture pre-rendering doesn't run on every network event.
 * Architecture is expensive (O(n²)) and should only run on explicit generation.
 */

import {
  rememberAtlasHtmlNetworkEvent,
  setAtlasDocHtmlOutputPath,
  resetAtlasDocHtmlRuntime
} from '../packages/mockifyer-core/src/utils/atlas-doc-html';
import type { NetworkEvent } from '../packages/mockifyer-core/src/utils/network-event-types';
import type { AtlasDocMap } from '../packages/mockifyer-core/src/utils/atlas-doc';

// Spy on the expensive architecture functions
const buildEndpointInventorySpy = jest.fn();
const generateArchitectureDocSpy = jest.fn();

jest.mock('../packages/mockifyer-core/src/utils/atlas-endpoint-inventory', () => {
  const actual = jest.requireActual('../packages/mockifyer-core/src/utils/atlas-endpoint-inventory');
  return {
    ...actual,
    buildEndpointInventory: (...args: any[]) => {
      buildEndpointInventorySpy();
      return actual.buildEndpointInventory(...args);
    }
  };
});

jest.mock('../packages/mockifyer-core/src/utils/atlas-architecture-doc', () => {
  const actual = jest.requireActual('../packages/mockifyer-core/src/utils/atlas-architecture-doc');
  return {
    ...actual,
    generateArchitectureDoc: (...args: any[]) => {
      generateArchitectureDocSpy();
      return actual.generateArchitectureDoc(...args);
    }
  };
});

describe('Atlas architecture pre-rendering', () => {
  beforeEach(() => {
    resetAtlasDocHtmlRuntime();
    buildEndpointInventorySpy.mockClear();
    generateArchitectureDocSpy.mockClear();
    // Disable HTML output for most tests
    setAtlasDocHtmlOutputPath(undefined);
  });

  it('does not call architecture builders when recording N events without HTML output', () => {
    const N = 10;
    
    // Record N events
    for (let i = 0; i < N; i++) {
      const event: NetworkEvent = {
        id: `evt-${i}`,
        requestId: `req-${i}`,
        timestamp: new Date().toISOString(),
        scenario: 'test',
        transport: 'fetch' as const,
        method: 'GET',
        url: `https://api.example.com/endpoint/${i}`,
        path: `/endpoint/${i}`,
        source: 'upstream' as const,
        status: 200,
        durationMs: 100
      };
      rememberAtlasHtmlNetworkEvent(event);
    }
    
    // Architecture builders should not have been called at all
    expect(buildEndpointInventorySpy).not.toHaveBeenCalled();
    expect(generateArchitectureDocSpy).not.toHaveBeenCalled();
  });
});
