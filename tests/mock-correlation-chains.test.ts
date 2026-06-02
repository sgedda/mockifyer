import {
  buildMockServiceChains,
  buildMockServiceChainsForDisplay,
} from '../packages/mockifyer-dashboard/frontend/src/lib/mock-correlation-chains';
import type { MockFile } from '../packages/mockifyer-dashboard/frontend/src/types';

function mockFile(
  filename: string,
  requestId: string,
  parentRequestId: string | null,
  modified: string
): MockFile {
  return {
    filename,
    filePath: filename,
    size: 1,
    created: modified,
    modified,
    endpoint: `https://api.example.com/${filename}`,
    method: 'GET',
    graphqlInfo: null,
    sessionId: null,
    requestId,
    parentRequestId,
  };
}

describe('mock-correlation-chains', () => {
  it('does not recurse forever when child correlation metadata contains a cycle', () => {
    const root = mockFile('root.json', 'root', null, '2026-05-31T00:00:00.000Z');
    const childA = mockFile('child-a.json', 'child-a', 'root', '2026-05-31T00:00:01.000Z');
    const childB = mockFile('child-b.json', 'child-b', 'child-a', '2026-05-31T00:00:02.000Z');
    const childC = mockFile('child-c.json', 'child-a', 'child-b', '2026-05-31T00:00:03.000Z');

    const chains = buildMockServiceChains([root, childA, childB, childC]);

    expect(chains).toHaveLength(1);
    expect(chains[0].hops.map((hop) => hop.filename)).toEqual([
      'root.json',
      'child-a.json',
      'child-b.json',
      'child-c.json',
    ]);
  });

  it('keeps display chain derivation cycle-safe', () => {
    const root = mockFile('root.json', 'root', null, '2026-05-31T00:00:00.000Z');
    const childA = mockFile('child-a.json', 'child-a', 'root', '2026-05-31T00:00:01.000Z');
    const childB = mockFile('child-b.json', 'child-b', 'child-a', '2026-05-31T00:00:02.000Z');
    const childC = mockFile('child-c.json', 'child-a', 'child-b', '2026-05-31T00:00:03.000Z');

    const chains = buildMockServiceChainsForDisplay([root, childA, childB, childC]);

    expect(chains[0].hops.map((hop) => hop.filename)).toEqual([
      'root.json',
      'child-a.json',
      'child-b.json',
      'child-c.json',
    ]);
  });
});
