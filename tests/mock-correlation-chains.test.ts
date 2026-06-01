import {
  collectUpstreamDomainPathsForReplay,
} from '../packages/mockifyer-dashboard/frontend/src/lib/mock-correlation-chains';
import type { MockFile } from '../packages/mockifyer-dashboard/frontend/src/types';

function mockFile(overrides: Partial<MockFile> & Pick<MockFile, 'filename' | 'endpoint'>): MockFile {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    filePath: overrides.filename,
    size: 1,
    created: now,
    modified: now,
    graphqlInfo: null,
    sessionId: null,
    ...overrides,
  };
}

describe('collectUpstreamDomainPathsForReplay', () => {
  it('uses request-id links to choose upstream domains', () => {
    const gateway = mockFile({
      filename: 'gateway.json',
      endpoint: 'https://gateway.example.com/aggregate',
      requestId: 'gateway-hop',
    });
    const downstream = mockFile({
      filename: 'downstream.json',
      endpoint: 'https://jsonplaceholder.typicode.com/todos/1',
      requestId: 'downstream-hop',
      parentRequestId: 'gateway-hop',
    });

    expect(collectUpstreamDomainPathsForReplay([downstream], [gateway, downstream])).toEqual([
      'gateway.example.com/aggregate',
    ]);
  });

  it('does not mutate unrelated mocks based only on URL order and timestamp', () => {
    const unrelatedGateway = mockFile({
      filename: 'unrelated-gateway.json',
      endpoint: 'https://gateway.example.com/aggregate',
    });
    const downstream = mockFile({
      filename: 'downstream.json',
      endpoint: 'https://jsonplaceholder.typicode.com/todos/1',
    });

    expect(collectUpstreamDomainPathsForReplay([downstream], [unrelatedGateway, downstream])).toEqual([]);
  });

  it('does not use display-only enriched hops for replay side effects', () => {
    const enrichedEntry = mockFile({
      filename: 'entry.json',
      endpoint: 'https://gateway.example.com/aggregate',
    });
    const parent = mockFile({
      filename: 'parent.json',
      endpoint: 'https://middle.example.com/via-axios',
      requestId: 'parent-hop',
    });
    const downstream = mockFile({
      filename: 'downstream.json',
      endpoint: 'https://jsonplaceholder.typicode.com/todos/1',
      requestId: 'downstream-hop',
      parentRequestId: 'parent-hop',
    });

    expect(
      collectUpstreamDomainPathsForReplay([downstream], [enrichedEntry, parent, downstream])
    ).toEqual(['middle.example.com/via-axios']);
  });
});
