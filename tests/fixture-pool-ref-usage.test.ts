import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  findPoolRefReferencingScenariosOnDisk,
  listScenarioMockJsonFiles,
  mergeReferencingScenarios,
  mockDataReferencesPoolResponse,
} from '../packages/mockifyer-dashboard/src/utils/fixture-pool-ref-usage';

describe('fixture-pool-ref-usage', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-pool-ref-usage-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('detects $pool embeds in mock response data', () => {
    expect(
      mockDataReferencesPoolResponse(
        {
          response: {
            status: 200,
            headers: {},
            data: { $pool: { id: 'trips-list-alice', mode: 'document' } },
          },
        },
        'trips-list-alice'
      )
    ).toBe(true);
    expect(
      mockDataReferencesPoolResponse(
        {
          response: {
            status: 200,
            headers: {},
            data: { nested: { $pool: { id: 'trips-list-alice' } } },
          },
        },
        'trips-list-alice'
      )
    ).toBe(true);
    expect(
      mockDataReferencesPoolResponse(
        {
          response: {
            status: 200,
            headers: {},
            data: { $pool: { id: 'other', mode: 'document' } },
          },
        },
        'trips-list-alice'
      )
    ).toBe(false);
  });

  it('finds filesystem scenarios that embed a $pool response id', () => {
    const scenarioDir = path.join(root, 'check-in-open');
    fs.mkdirSync(scenarioDir, { recursive: true });
    fs.writeFileSync(
      path.join(scenarioDir, 'scenario-config.json'),
      JSON.stringify({ name: 'check-in-open' })
    );
    fs.writeFileSync(
      path.join(scenarioDir, 'GET-trips.json'),
      JSON.stringify({
        request: { method: 'GET', url: 'https://api.example.com/trips', headers: {} },
        response: {
          status: 200,
          headers: {},
          data: { $pool: { id: 'trips-list-alice', mode: 'document' } },
        },
        timestamp: new Date().toISOString(),
      })
    );

    const unusedDir = path.join(root, 'default');
    fs.mkdirSync(unusedDir, { recursive: true });
    fs.writeFileSync(
      path.join(unusedDir, 'GET-health.json'),
      JSON.stringify({
        request: { method: 'GET', url: 'https://api.example.com/health', headers: {} },
        response: { status: 200, headers: {}, data: { ok: true } },
        timestamp: new Date().toISOString(),
      })
    );

    expect(findPoolRefReferencingScenariosOnDisk(root, 'trips-list-alice')).toEqual([
      'check-in-open',
    ]);
    expect(findPoolRefReferencingScenariosOnDisk(root, 'missing')).toEqual([]);
  });

  it('skips config/manifest files and still finds nested mock paths', () => {
    const scenarioDir = path.join(root, 'nested');
    const nestedDir = path.join(scenarioDir, 'api');
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(
      path.join(scenarioDir, 'scenario-manifest.json'),
      JSON.stringify({ scenario: 'nested', slots: [], updatedAt: new Date().toISOString() })
    );
    fs.writeFileSync(
      path.join(nestedDir, 'trips.json'),
      JSON.stringify({
        request: { method: 'GET', url: 'https://api.example.com/trips', headers: {} },
        response: {
          status: 200,
          headers: {},
          data: { payload: { $pool: { id: 'trips-list-alice' } } },
        },
        timestamp: new Date().toISOString(),
      })
    );

    const files = listScenarioMockJsonFiles(scenarioDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain(`${path.sep}api${path.sep}trips.json`);
    expect(findPoolRefReferencingScenariosOnDisk(root, 'trips-list-alice')).toEqual(['nested']);
  });

  it('merges referencing scenario lists uniquely', () => {
    expect(mergeReferencingScenarios(['b', 'a'], ['a', 'c'], [])).toEqual(['a', 'b', 'c']);
  });
});
