import { MemoryProvider } from '../../packages/mockifyer-core/src/providers/memory-provider';
import { generateRequestKey } from '../../packages/mockifyer-core/src/utils/mock-matcher';
import type { MockData } from '../../packages/mockifyer-core/src/types';

const mockData: MockData = {
  request: { method: 'GET', url: 'https://api.example.com/bundled', headers: {} },
  response: { status: 200, data: { bundled: true }, headers: {} },
  timestamp: '2020-01-01T00:00:00.000Z',
};

describe('MemoryProvider', () => {
  it('preloads configured initial mocks during initialization', () => {
    const provider = new MemoryProvider({ options: { initialMocks: [mockData] } });

    provider.initialize();

    const match = provider.findExactMatch(mockData.request, generateRequestKey(mockData.request));
    expect(match?.mockData.response.data).toEqual({ bundled: true });
  });
});
