import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import {
  EXIT_ERROR,
  EXIT_OK,
  helpText,
  parseArgv,
  runCli,
} from '../packages/mockifyer-generator/src/cli';

const REPO_ROOT = path.resolve(__dirname, '..');
const CLI_BIN = path.join(
  REPO_ROOT,
  'packages/mockifyer-generator/dist/cli/index.js'
);

const SAMPLE_MOCK = {
  request: {
    method: 'GET',
    url: 'https://api.example.com/trips',
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
        },
      ],
    },
    headers: { 'content-type': 'application/json' },
  },
  timestamp: '2026-01-15T12:00:00.000Z',
  duration: 12,
};

function captureIo() {
  let stdout = '';
  let stderr = '';
  return {
    io: {
      stdout: { write(chunk: string) { stdout += chunk; } },
      stderr: { write(chunk: string) { stderr += chunk; } },
    },
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
    },
  };
}

function writeTempJson(dir: string, name: string, value: unknown): string {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

describe('generator CLI — parseArgv', () => {
  it('treats --dry-run as boolean and keeps following positionals', () => {
    const parsed = parseArgv([
      'variants',
      '--dry-run',
      'mock.json',
      '--seed',
      '42',
    ]);
    expect(parsed.positionals).toEqual(['variants', 'mock.json']);
    expect(parsed.flags.get('dry-run')).toBe(true);
    expect(parsed.flags.get('seed')).toBe('42');
  });

  it('supports --flag=value form', () => {
    const parsed = parseArgv(['sample', '--count=3', '--locale=sv']);
    expect(parsed.flags.get('count')).toBe('3');
    expect(parsed.flags.get('locale')).toBe('sv');
  });
});

describe('generator CLI — variants', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-gen-cli-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('dry-run prints summary + JSON and writes nothing', async () => {
    const mockPath = writeTempJson(tmpDir, 'mock.json', SAMPLE_MOCK);
    const outDir = path.join(tmpDir, 'mock-data');
    const cap = captureIo();

    const code = await runCli(
      [
        'variants',
        mockPath,
        '--level',
        'mild',
        '--seed',
        '99',
        '--out',
        outDir,
        '--dry-run',
      ],
      cap.io
    );

    expect(code).toBe(EXIT_OK);
    expect(cap.stdout).toContain('Generated');
    expect(cap.stdout).toContain('empty-lists');
    expect(cap.stdout).toContain('"kind"');
    expect(fs.existsSync(outDir)).toBe(false);
  });

  it('writes scenario files under --out mock-data dir', async () => {
    const mockPath = writeTempJson(tmpDir, 'mock.json', SAMPLE_MOCK);
    const outDir = path.join(tmpDir, 'mock-data');
    const cap = captureIo();

    const code = await runCli(
      [
        'variants',
        mockPath,
        '--level',
        'realistic',
        '--seed',
        '7',
        '--out',
        outDir,
        '--scenario-prefix',
        'trip',
      ],
      cap.io
    );

    expect(code).toBe(EXIT_OK);
    expect(cap.stdout).toContain('Wrote');
    expect(fs.existsSync(outDir)).toBe(true);

    const scenarios = fs.readdirSync(outDir);
    expect(scenarios.length).toBeGreaterThan(0);
    expect(scenarios.every((s) => s.startsWith('trip-'))).toBe(true);

    const emptyScenario = path.join(outDir, 'trip-empty-lists');
    expect(fs.existsSync(emptyScenario)).toBe(true);
    // Core-compatible layout: {host}/{path…}/GET_….json (not generated/*.json)
    const jsonFiles: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.json')) jsonFiles.push(full);
      }
    };
    walk(emptyScenario);
    expect(jsonFiles.length).toBe(1);
    const rel = path.relative(emptyScenario, jsonFiles[0]!).replace(/\\/g, '/');
    expect(rel).toMatch(/^api\.example\.com\/trips\/GET_/);
    expect(rel).not.toMatch(/^generated\//);
    const written = JSON.parse(fs.readFileSync(jsonFiles[0]!, 'utf8')) as {
      generated: boolean;
      response: { data: { trips: unknown[] } };
    };
    expect(written.generated).toBe(true);
    expect(written.response.data.trips).toEqual([]);
  });

  it('is deterministic with the same --seed', async () => {
    const mockPath = writeTempJson(tmpDir, 'mock.json', SAMPLE_MOCK);
    const capA = captureIo();
    const capB = captureIo();

    const args = [
      'variants',
      mockPath,
      '--level',
      'wild',
      '--seed',
      '12345',
      '--dry-run',
    ];

    expect(await runCli(args, capA.io)).toBe(EXIT_OK);
    expect(await runCli(args, capB.io)).toBe(EXIT_OK);
    expect(capA.stdout).toBe(capB.stdout);
  });

  it('errors on missing file', async () => {
    const cap = captureIo();
    const missing = path.join(tmpDir, 'nope.json');
    const code = await runCli(['variants', missing, '--dry-run'], cap.io);
    expect(code).toBe(EXIT_ERROR);
    expect(cap.stderr).toMatch(/File not found/i);
  });

  it('errors on non-mock JSON', async () => {
    const badPath = writeTempJson(tmpDir, 'bare.json', { hello: 'world' });
    const cap = captureIo();
    const code = await runCli(['variants', badPath, '--dry-run'], cap.io);
    expect(code).toBe(EXIT_ERROR);
    expect(cap.stderr).toMatch(/Not a Mockifyer mock file/i);
  });

  it('errors on unknown kind', async () => {
    const mockPath = writeTempJson(tmpDir, 'mock.json', SAMPLE_MOCK);
    const cap = captureIo();
    const code = await runCli(
      ['variants', mockPath, '--kinds', 'notAKind', '--dry-run'],
      cap.io
    );
    expect(code).toBe(EXIT_ERROR);
    expect(cap.stderr).toMatch(/Unknown variant kind/i);
  });
});

describe('generator CLI — sample', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-gen-cli-sample-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates from --context and prints JSON', async () => {
    const cap = captureIo();
    const code = await runCli(
      ['sample', '--context', 'swedish users, 3 items', '--seed', '42'],
      cap.io
    );
    expect(code).toBe(EXIT_OK);
    const parsed = JSON.parse(cap.stdout) as Array<{
      items?: unknown[];
      currency?: string;
      phone?: string;
    }>;
    expect(Array.isArray(parsed)).toBe(true);
    // "3 items" → nested length; users → 1 record (user shape + injected items)
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.items).toHaveLength(3);
    expect(typeof parsed[0]!.phone).toBe('string');
  });

  it('writes to --out file and is seed-deterministic', async () => {
    const samplePath = writeTempJson(tmpDir, 'user.json', {
      id: 1,
      email: 'a@b.com',
      status: 'active',
    });
    const outA = path.join(tmpDir, 'a.json');
    const outB = path.join(tmpDir, 'b.json');

    const cap = captureIo();
    expect(
      await runCli(
        ['sample', samplePath, '--count', '2', '--seed', '77', '--out', outA],
        cap.io
      )
    ).toBe(EXIT_OK);
    expect(
      await runCli(
        ['sample', samplePath, '--count', '2', '--seed', '77', '--out', outB],
        cap.io
      )
    ).toBe(EXIT_OK);

    expect(fs.readFileSync(outA, 'utf8')).toBe(fs.readFileSync(outB, 'utf8'));
  });

  it('errors on unknown locale', async () => {
    const cap = captureIo();
    const code = await runCli(
      ['sample', '--context', 'users', '--locale', 'ja', '--seed', '1'],
      cap.io
    );
    expect(code).toBe(EXIT_ERROR);
    expect(cap.stderr).toMatch(/Unknown locale/i);
  });

  it('errors when neither sample nor context is provided', async () => {
    const cap = captureIo();
    const code = await runCli(['sample', '--seed', '1'], cap.io);
    expect(code).toBe(EXIT_ERROR);
    expect(cap.stderr).toMatch(/requires a JSON sample file and\/or --context/i);
  });
});

describe('generator CLI — help', () => {
  it('prints help for --help and exits 0', async () => {
    const cap = captureIo();
    const code = await runCli(['--help'], cap.io);
    expect(code).toBe(EXIT_OK);
    expect(cap.stdout).toContain('mockifyer-generate');
    expect(cap.stdout).toContain('variants');
    expect(helpText()).toContain('EXIT CODES');
  });
});

describe('generator CLI — built bin spawn', () => {
  const binExists = fs.existsSync(CLI_BIN);

  (binExists ? it : it.skip)(
    'spawns dist/cli.js variants --dry-run successfully',
    () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-gen-bin-'));
      try {
        const mockPath = writeTempJson(tmpDir, 'mock.json', SAMPLE_MOCK);
        const result = spawnSync(process.execPath, [CLI_BIN, 'variants', mockPath, '--dry-run', '--seed', '1', '--level', 'realistic'], {
          encoding: 'utf8',
          env: process.env,
        });
        expect(result.status).toBe(EXIT_OK);
        expect(result.stdout).toContain('Generated');
        expect(result.stderr).toBe('');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    }
  );
});
