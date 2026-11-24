/**
 * Integration: CLI-written variant scenarios must replay through
 * `@sgedda/mockifyer-fetch` setupMockifyer with the network blocked.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import { variants } from '@sgedda/mockifyer-generator';
import { writeVariantScenarios } from '@sgedda/mockifyer-generator/node';
import { runCli } from '../packages/mockifyer-generator/src/cli';

const TRIPS_MOCK = {
  request: {
    method: 'GET',
    url: 'http://localhost:4100/api/trips',
    headers: {},
  },
  response: {
    status: 200,
    data: {
      trips: [
        {
          id: 'TRP-001',
          destination: 'Paris',
          duration: 5,
          passengers: 2,
          departureDate: '2026-12-01',
        },
      ],
      timestamp: '2026-11-10T12:00:00Z',
    },
    headers: { 'content-type': 'application/json' },
  },
  timestamp: '2026-11-10T12:00:00.000Z',
  duration: 50,
};

describe('generator CLI — written scenario replay (fetch)', () => {
  let mockDataPath: string;
  let prevScenario: string | undefined;
  let prevDomainPathRulesMode: string | undefined;
  let prevRecordAlwaysLive: string | undefined;

  beforeEach(() => {
    mockDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-gen-replay-'));
    prevScenario = process.env.MOCKIFYER_SCENARIO;
    prevDomainPathRulesMode = process.env.MOCKIFYER_DOMAIN_PATH_RULES_MODE;
    prevRecordAlwaysLive = process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API;
    process.env.MOCKIFYER_DOMAIN_PATH_RULES_MODE = 'off';
    process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API = 'false';
  });

  afterEach(() => {
    if (prevScenario === undefined) {
      delete process.env.MOCKIFYER_SCENARIO;
    } else {
      process.env.MOCKIFYER_SCENARIO = prevScenario;
    }
    if (prevDomainPathRulesMode === undefined) {
      delete process.env.MOCKIFYER_DOMAIN_PATH_RULES_MODE;
    } else {
      process.env.MOCKIFYER_DOMAIN_PATH_RULES_MODE = prevDomainPathRulesMode;
    }
    if (prevRecordAlwaysLive === undefined) {
      delete process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API;
    } else {
      process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API = prevRecordAlwaysLive;
    }
    fs.rmSync(mockDataPath, { recursive: true, force: true });
  });

  it('replays CLI-written empty-lists variant with network blocked', async () => {
    const mockFile = path.join(mockDataPath, 'source-mock.json');
    fs.writeFileSync(mockFile, `${JSON.stringify(TRIPS_MOCK, null, 2)}\n`, 'utf8');

    const outDir = path.join(mockDataPath, 'mock-data');
    let stdout = '';
    const code = await runCli(
      [
        'variants',
        mockFile,
        '--level',
        'realistic',
        '--seed',
        '42',
        '--out',
        outDir,
        '--scenario-prefix',
        'trip',
      ],
      {
        stdout: { write(chunk: string) { stdout += chunk; } },
        stderr: { write() { /* ignore */ } },
      }
    );
    expect(code).toBe(0);
    expect(stdout).toContain('Wrote');

    const scenario = 'trip-empty-lists';
    const scenarioDir = path.join(outDir, scenario);
    expect(fs.existsSync(scenarioDir)).toBe(true);

    // Prove layout is host/path/METHOD_… not generated/
    const writtenFiles: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.json')) writtenFiles.push(full);
      }
    };
    walk(scenarioDir);
    expect(writtenFiles.length).toBe(1);
    const rel = path.relative(scenarioDir, writtenFiles[0]!).replace(/\\/g, '/');
    expect(rel).toMatch(/^localhost\/api\/trips\/GET_/);
    expect(rel).not.toContain('generated/');

    const onDisk = JSON.parse(fs.readFileSync(writtenFiles[0]!, 'utf8')) as {
      response: { data: { trips: unknown[] } };
    };
    expect(onDisk.response.data.trips).toEqual([]);

    process.env.MOCKIFYER_SCENARIO = scenario;

    const blockedFetch = jest.fn(() => {
      throw new Error('NETWORK_BLOCKED: real fetch must not run during mock replay');
    });
    const originalFetch = global.fetch;
    global.fetch = blockedFetch as unknown as typeof fetch;

    try {
      const client = setupMockifyer({
        mockDataPath: outDir,
        recordMode: false,
        useGlobalFetch: false,
      });

      const response = await client.get('http://localhost:4100/api/trips');
      expect(response.status).toBe(200);
      expect(response.data).toEqual({
        trips: [],
        timestamp: '2026-11-10T12:00:00Z',
      });
      expect(blockedFetch).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('writeVariantScenarios layout matches core host/path and replays via provider path', () => {
    const named = variants(TRIPS_MOCK, {
      seed: 42,
      chaosLevel: 'realistic',
      scenario: 'trip',
    });
    const written = writeVariantScenarios(named, { mockDataPath: mockDataPath });
    expect(written).toHaveLength(1);
    expect(written[0]!.relativeFile.replace(/\\/g, '/')).toMatch(
      /^localhost\/api\/trips\/GET_/
    );
  });
});
