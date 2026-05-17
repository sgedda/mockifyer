import fs from 'fs';
import os from 'os';
import path from 'path';
import { RedisMockStore } from '../packages/mockifyer-dashboard/src/utils/redis-mock-store';
import {
  findMockOnDiskByRequestHash,
  mirrorRecordedMockToDisk,
} from '../packages/mockifyer-dashboard/src/utils/redis-disk-mirror';

function makeMock(url = 'https://api.example.com/data') {
  return {
    request: {
      method: 'GET',
      url,
      headers: {},
      queryParams: {},
    },
    response: {
      status: 200,
      data: { ok: true },
      headers: {},
    },
    timestamp: '2026-05-17T00:00:00.000Z',
  };
}

describe('dashboard proxy scenario safety', () => {
  let tmpDir: string;
  let mockDataPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-proxy-safety-'));
    mockDataPath = path.join(tmpDir, 'mock-data');
    fs.mkdirSync(mockDataPath, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rejects unsafe body scenario overrides before proxy resolution', async () => {
    const store = Object.create(RedisMockStore.prototype) as RedisMockStore;

    await expect(store.resolveProxyScenario('../escape', 'lane-1')).rejects.toThrow(
      'Invalid scenario name'
    );
  });

  it('does not mirror recordings outside the mock data root for unsafe scenarios', () => {
    const mock = makeMock();
    const hash = RedisMockStore.hashForMock(mock);

    expect(() =>
      mirrorRecordedMockToDisk({
        mockDataPath,
        scenarioName: '../escape',
        hash,
        mockData: mock,
      })
    ).toThrow('Invalid scenario name');

    expect(fs.existsSync(path.join(tmpDir, 'escape', 'redis', `${hash}.json`))).toBe(false);
  });

  it('does not read disk fallback mocks outside the mock data root for unsafe scenarios', () => {
    const mock = makeMock('https://api.example.com/outside');
    const hash = RedisMockStore.hashForMock(mock);
    const escapedScenarioPath = path.join(tmpDir, 'escape');
    fs.mkdirSync(escapedScenarioPath, { recursive: true });
    fs.writeFileSync(path.join(escapedScenarioPath, 'outside.json'), JSON.stringify(mock, null, 2));

    expect(() => findMockOnDiskByRequestHash(mockDataPath, '../escape', hash)).toThrow(
      'Invalid scenario name'
    );
  });
});
