import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import type { MockifyerInstance } from '@sgedda/mockifyer-fetch';
import path from 'path';
import fs from 'fs';

describe('setClientId runtime (fetch)', () => {
  const testMockDataPath = path.join(__dirname, './test-mock-data-set-client-id');

  beforeEach(() => {
    fs.mkdirSync(testMockDataPath, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testMockDataPath)) {
      fs.rmSync(testMockDataPath, { recursive: true, force: true });
    }
  });

  it('exposes initial lane via getClientId and updates with setClientId', () => {
    const client = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalFetch: false,
      clientId: 'lane-alpha',
    }) as MockifyerInstance;

    expect(client.getClientId()).toBe('lane-alpha');
    client.setClientId('lane-beta');
    expect(client.getClientId()).toBe('lane-beta');
  });

  it('throws when setClientId is empty or whitespace', () => {
    const client = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalFetch: false,
      clientId: 'lane-alpha',
    }) as MockifyerInstance;

    expect(() => client.setClientId('')).toThrow(/non-empty string/);
    expect(() => client.setClientId('   ')).toThrow(/non-empty string/);
  });
});
