import {
  setupMockifyer,
  getClientId,
  setClientId,
  clearMockifyerClientIdRuntime,
} from '@sgedda/mockifyer-fetch';
import path from 'path';
import fs from 'fs';

describe('runtime client id (module-level)', () => {
  const testMockDataPath = path.join(__dirname, './test-mock-data-runtime-client-id');

  beforeEach(() => {
    clearMockifyerClientIdRuntime();
    fs.mkdirSync(testMockDataPath, { recursive: true });
  });

  afterEach(() => {
    clearMockifyerClientIdRuntime();
    if (fs.existsSync(testMockDataPath)) {
      fs.rmSync(testMockDataPath, { recursive: true, force: true });
    }
  });

  it('getClientId returns undefined before setupMockifyer', () => {
    expect(getClientId()).toBeUndefined();
  });

  it('exposes lane via module getClientId after setupMockifyer', () => {
    setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalFetch: false,
      clientId: 'lane-alpha',
    });

    expect(getClientId()).toBe('lane-alpha');
  });

  it('module setClientId updates the active instance', () => {
    const client = setupMockifyer({
      mockDataPath: testMockDataPath,
      recordMode: false,
      useGlobalFetch: false,
      clientId: 'lane-alpha',
    });

    setClientId('lane-beta');
    expect(getClientId()).toBe('lane-beta');
    expect(client.getClientId()).toBe('lane-beta');
  });

  it('throws when module setClientId is called before setup', () => {
    expect(() => setClientId('lane-x')).toThrow(/not initialized/);
  });
});
