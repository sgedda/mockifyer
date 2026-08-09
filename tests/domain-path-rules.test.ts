import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  collapseDomainPathIdSegments,
  discoverDomainPathRulesForUrl,
  DomainPathRulesSession,
  endpointUrlToDomainPath,
  findLongestDomainPathRule,
  findLongestDomainPathRuleForFolder,
  isUsableNodeFsModule,
  mergeDomainPathRuleUpserts,
  mergeDiscoveredDomainPathRules,
  normalizeDomainPathForDiscovery,
  readDomainPathRulesFile,
  resolveDomainPathRulesMode,
  resolveDomainPathTrafficGate,
  resolveRecordResponsesForRequest,
  envRecordResponsesOverride,
  upsertDiscoveredDomainPathRule,
  writeDomainPathRulesFile,
  type DomainPathRulesMap,
} from '@sgedda/mockifyer-core';

describe('domain-path-rules', () => {
  const rules: DomainPathRulesMap = {
    'api.example.com': { recordResponses: true, autoMock: true },
    'api.example.com/v1/users': { recordResponses: false, autoMock: false },
  };

  it('endpointUrlToDomainPath builds host/path key', () => {
    expect(endpointUrlToDomainPath('https://api.example.com/v1/users/42?q=1')).toBe(
      'api.example.com/v1/users/42'
    );
  });

  it('findLongestDomainPathRule picks the longest prefix', () => {
    const match = findLongestDomainPathRule('https://api.example.com/v1/users/list', rules);
    expect(match?.domainPath).toBe('api.example.com/v1/users');
    expect(match?.rule.recordResponses).toBe(false);
  });

  it('findLongestDomainPathRuleForFolder matches folder keys', () => {
    const match = findLongestDomainPathRuleForFolder('api.example.com/v1', rules);
    expect(match?.domainPath).toBe('api.example.com');
    expect(match?.rule.autoMock).toBe(true);
  });

  it('resolveRecordResponsesForRequest prefers path rules over client body', () => {
    const resolved = resolveRecordResponsesForRequest({
      url: 'https://api.example.com/other',
      pathRules: rules,
      fromBody: false,
      fromScenario: true,
    });
    expect(resolved.recordResponses).toBe(true);
    expect(resolved.matchedDomainPath).toBe('api.example.com');
  });

  it('resolveRecordResponsesForRequest uses client body when no path rule matches', () => {
    const resolved = resolveRecordResponsesForRequest({
      url: 'https://other.example.com/x',
      pathRules: rules,
      fromBody: true,
      fromScenario: false,
    });
    expect(resolved.recordResponses).toBe(true);
    expect(resolved.matchedPathRule).toBeNull();
  });

  it('resolveRecordResponsesForRequest defaults to false', () => {
    const resolved = resolveRecordResponsesForRequest({
      url: 'https://other.example.com/x',
      pathRules: {},
    });
    expect(resolved.recordResponses).toBe(false);
  });
});

describe('domain-path discovery + traffic gate', () => {
  const modeKey = 'MOCKIFYER_DOMAIN_PATH_RULES_MODE';
  let prevMode: string | undefined;

  beforeEach(() => {
    prevMode = process.env[modeKey];
    delete process.env[modeKey];
  });

  afterEach(() => {
    if (prevMode === undefined) delete process.env[modeKey];
    else process.env[modeKey] = prevMode;
  });

  it('resolveDomainPathRulesMode defaults to allowlist', () => {
    expect(resolveDomainPathRulesMode()).toBe('allowlist');
  });

  it('resolveDomainPathRulesMode reads env and config', () => {
    process.env[modeKey] = 'record_all';
    expect(resolveDomainPathRulesMode()).toBe('record_all');
    expect(resolveDomainPathRulesMode({ configMode: 'off' })).toBe('off');
  });

  it('collapseDomainPathIdSegments replaces numeric and UUID segments', () => {
    expect(collapseDomainPathIdSegments('api.example.com/v1/users/42')).toBe(
      'api.example.com/v1/users/:id'
    );
    expect(
      collapseDomainPathIdSegments('api.example.com/items/550e8400-e29b-41d4-a716-446655440000')
    ).toBe('api.example.com/items/:id');
  });

  it('normalizeDomainPathForDiscovery collapses ids', () => {
    expect(normalizeDomainPathForDiscovery('https://api.example.com/v1/users/99')).toBe(
      'api.example.com/v1/users/:id'
    );
  });

  it('upsertDiscoveredDomainPathRule inserts host + path without overwriting', () => {
    const map: DomainPathRulesMap = {
      'api.example.com': { recordResponses: true, autoMock: true },
    };
    const first = upsertDiscoveredDomainPathRule(map, 'api.example.com/v1/weather', {
      recordResponses: false,
      autoMock: false,
    });
    expect(first.changed).toBe(true);
    expect(map['api.example.com'].recordResponses).toBe(true);
    expect(map['api.example.com/v1/weather']).toEqual({
      recordResponses: false,
      autoMock: false,
    });

    const second = upsertDiscoveredDomainPathRule(map, 'api.example.com/v1/weather', {
      recordResponses: true,
      autoMock: true,
    });
    expect(second.changed).toBe(false);
    expect(map['api.example.com/v1/weather'].recordResponses).toBe(false);
  });

  it('discoverDomainPathRulesForUrl uses allowlist defaults', () => {
    const map: DomainPathRulesMap = {};
    const result = discoverDomainPathRulesForUrl(
      map,
      'https://api.example.com/v1/users/7',
      'allowlist'
    );
    expect(result.changed).toBe(true);
    expect(map['api.example.com']).toEqual({ recordResponses: false, autoMock: false });
    expect(map['api.example.com/v1/users/:id']).toEqual({
      recordResponses: false,
      autoMock: false,
    });
  });

  it('discoverDomainPathRulesForUrl uses record_all defaults', () => {
    const { rules, changed } = mergeDiscoveredDomainPathRules(
      {},
      'https://api.example.com/health',
      'record_all'
    );
    expect(changed).toBe(true);
    expect(rules['api.example.com']).toEqual({ recordResponses: true, autoMock: true });
    expect(rules['api.example.com/health']).toEqual({ recordResponses: true, autoMock: true });
  });

  it('allowlist denies unmatched and honors longest rule', () => {
    const unmatched = resolveDomainPathTrafficGate(
      'https://other.example.com/x',
      {},
      'allowlist'
    );
    expect(unmatched.mayRecord).toBe(false);
    expect(unmatched.mayReplay).toBe(false);

    const gate = resolveDomainPathTrafficGate(
      'https://api.example.com/v1/users/1',
      {
        'api.example.com': { recordResponses: true, autoMock: true },
        'api.example.com/v1/users/:id': { recordResponses: false, autoMock: false },
      },
      'allowlist'
    );
    expect(gate.matchedDomainPath).toBe('api.example.com/v1/users/:id');
    expect(gate.mayRecord).toBe(false);
    expect(gate.mayReplay).toBe(false);
  });

  it('record_all allows unmatched and can disable a child path', () => {
    const unmatched = resolveDomainPathTrafficGate(
      'https://other.example.com/x',
      {},
      'record_all'
    );
    expect(unmatched.mayRecord).toBe(true);
    expect(unmatched.mayReplay).toBe(true);

    const gate = resolveDomainPathTrafficGate(
      'https://api.example.com/v1/analytics',
      {
        'api.example.com': { recordResponses: true, autoMock: true },
        'api.example.com/v1/analytics': { recordResponses: false, autoMock: false },
      },
      'record_all'
    );
    expect(gate.mayRecord).toBe(false);
    expect(gate.mayReplay).toBe(false);
  });

  it('mode off always allows', () => {
    const gate = resolveDomainPathTrafficGate('https://api.example.com/x', {}, 'off');
    expect(gate.mayRecord).toBe(true);
    expect(gate.mayReplay).toBe(true);
  });

  it('mergeDomainPathRuleUpserts never overwrites existing keys', () => {
    const { rules, changed } = mergeDomainPathRuleUpserts(
      { 'api.example.com': { recordResponses: false, autoMock: false } },
      {
        'api.example.com': { recordResponses: true, autoMock: true },
        'api.example.com/v1': { recordResponses: true, autoMock: true },
      }
    );
    expect(changed).toBe(true);
    expect(rules['api.example.com'].recordResponses).toBe(false);
    expect(rules['api.example.com/v1'].recordResponses).toBe(true);
  });
});

describe('DomainPathRulesSession persistUpserts', () => {
  let tmpRoot: string;
  let prevScenario: string | undefined;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-dpr-session-'));
    prevScenario = process.env.MOCKIFYER_SCENARIO;
    process.env.MOCKIFYER_SCENARIO = 'default';
  });

  afterEach(() => {
    if (prevScenario === undefined) delete process.env.MOCKIFYER_SCENARIO;
    else process.env.MOCKIFYER_SCENARIO = prevScenario;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('preserves concurrent on-disk edits when discovering new keys', async () => {
    writeDomainPathRulesFile(tmpRoot, 'default', {
      'api.example.com': { recordResponses: true, autoMock: true },
      'api.example.com/v1': { recordResponses: false, autoMock: false },
    });

    const session = new DomainPathRulesSession({
      config: { mockDataPath: tmpRoot, domainPathRulesMode: 'record_all' },
    });
    // Warm in-memory cache from the initial on-disk rules.
    session.getTrafficGate('https://api.example.com/v1/users');

    // Simulate a dashboard edit that flips flags without changing key count.
    writeDomainPathRulesFile(tmpRoot, 'default', {
      'api.example.com': { recordResponses: false, autoMock: false },
      'api.example.com/v1': { recordResponses: true, autoMock: true },
    });

    session.discover('https://api.example.com/v1/users/42');
    await (session as unknown as { persistQueue: Promise<void> }).persistQueue;

    const onDisk = readDomainPathRulesFile(tmpRoot, 'default');
    expect(onDisk['api.example.com'].recordResponses).toBe(false);
    expect(onDisk['api.example.com'].autoMock).toBe(false);
    expect(onDisk['api.example.com/v1'].recordResponses).toBe(true);
    expect(onDisk['api.example.com/v1'].autoMock).toBe(true);
    expect(onDisk['api.example.com/v1/users/:id']).toBeDefined();
  });

  it('reloads rules when domain-path-rules.json mtime changes', () => {
    writeDomainPathRulesFile(tmpRoot, 'default', {
      'api.example.com': { recordResponses: false, autoMock: false },
    });

    const session = new DomainPathRulesSession({
      config: { mockDataPath: tmpRoot, domainPathRulesMode: 'allowlist' },
    });
    const before = session.getTrafficGate('https://api.example.com/v1');
    expect(before.mayRecord).toBe(false);
    expect(before.mayReplay).toBe(false);

    // Ensure mtime advances even on coarse filesystem clocks.
    const filePath = path.join(tmpRoot, 'default', 'domain-path-rules.json');
    const priorMtime = fs.statSync(filePath).mtimeMs;
    writeDomainPathRulesFile(tmpRoot, 'default', {
      'api.example.com': { recordResponses: true, autoMock: true },
    });
    fs.utimesSync(filePath, new Date(), new Date(priorMtime + 1000));

    const after = session.getTrafficGate('https://api.example.com/v1');
    expect(after.mayRecord).toBe(true);
    expect(after.mayReplay).toBe(true);
  });

  it('invalidateCache forces a reload from disk', () => {
    writeDomainPathRulesFile(tmpRoot, 'default', {
      'api.example.com': { recordResponses: false, autoMock: false },
    });

    const session = new DomainPathRulesSession({
      config: { mockDataPath: tmpRoot, domainPathRulesMode: 'allowlist' },
    });
    expect(session.getTrafficGate('https://api.example.com/x').mayRecord).toBe(false);

    writeDomainPathRulesFile(tmpRoot, 'default', {
      'api.example.com': { recordResponses: true, autoMock: true },
    });
    session.invalidateCache();
    expect(session.getTrafficGate('https://api.example.com/x').mayRecord).toBe(true);
  });

  it('persists discovery upserts to the scenario captured at discover time', async () => {
    writeDomainPathRulesFile(tmpRoot, 'default', {
      'api.example.com': { recordResponses: true, autoMock: true },
    });
    writeDomainPathRulesFile(tmpRoot, 'other', {
      'other.example.com': { recordResponses: false, autoMock: false },
    });

    const session = new DomainPathRulesSession({
      config: { mockDataPath: tmpRoot, domainPathRulesMode: 'record_all' },
    });

    // Hold the persist queue so we can switch scenario before the job runs.
    // Chain onto the existing queue — do not replace it, or discover()'s
    // `.then(persistUpserts)` may never run.
    let releasePersist!: () => void;
    const hold = new Promise<void>((resolve) => {
      releasePersist = resolve;
    });
    const sessionInternals = session as unknown as { persistQueue: Promise<void> };
    const originalQueue = sessionInternals.persistQueue;
    sessionInternals.persistQueue = originalQueue.then(() => hold);

    session.discover('https://api.example.com/v1/users/42');

    // Scenario changes while the discover persist is still queued.
    process.env.MOCKIFYER_SCENARIO = 'other';
    session.getTrafficGate('https://other.example.com/x');

    releasePersist();
    await sessionInternals.persistQueue;

    const defaultOnDisk = readDomainPathRulesFile(tmpRoot, 'default');
    expect(defaultOnDisk['api.example.com/v1/users/:id']).toBeDefined();

    const otherOnDisk = readDomainPathRulesFile(tmpRoot, 'other');
    expect(otherOnDisk['api.example.com/v1/users/:id']).toBeUndefined();
    expect(otherOnDisk['other.example.com'].recordResponses).toBe(false);

    // In-memory cache must still reflect the new scenario, not the delayed persist.
    const gate = session.getTrafficGate('https://other.example.com/x');
    expect(gate.matchedDomainPath).toBe('other.example.com');
  });
});

describe('DomainPathRulesSession Metro hydrate (RN Hybrid)', () => {
  let prevScenario: string | undefined;
  const projectRules: DomainPathRulesMap = {
    'api.example.com': { recordResponses: true, autoMock: true },
    'api.example.com/v1/users/:id': { recordResponses: true, autoMock: true },
  };

  beforeEach(() => {
    prevScenario = process.env.MOCKIFYER_SCENARIO;
    process.env.MOCKIFYER_SCENARIO = 'default';
  });

  afterEach(() => {
    if (prevScenario === undefined) delete process.env.MOCKIFYER_SCENARIO;
    else process.env.MOCKIFYER_SCENARIO = prevScenario;
  });

  function mockMetroFetch(store: { rules: DomainPathRulesMap; posts: unknown[] }): typeof fetch {
    return (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/mockifyer-domain-path-rules') && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, scenario: 'default', rules: store.rules }),
          text: async () => '',
        } as Response;
      }
      if (url.includes('/mockifyer-domain-path-rules') && method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}')) as {
          upserts?: DomainPathRulesMap;
        };
        store.posts.push(body);
        const merged = mergeDomainPathRuleUpserts(store.rules, body.upserts ?? {});
        store.rules = merged.rules;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, changed: merged.changed, rules: store.rules }),
          text: async () => '',
        } as Response;
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }) as typeof fetch;
  }

  it('hydrates project rules before discover seeds allowlist defaults', async () => {
    const store = { rules: { ...projectRules }, posts: [] as unknown[] };
    const session = new DomainPathRulesSession({
      config: { mockDataPath: './mock-data', domainPathRulesMode: 'allowlist' },
      useFilesystem: false,
      fetchFn: mockMetroFetch(store),
      metroPort: 8081,
    });

    await session.hydrate();

    const gate = session.getTrafficGate('https://api.example.com/v1/users/42');
    expect(gate.mayRecord).toBe(true);
    expect(gate.mayReplay).toBe(true);
    expect(gate.matchedDomainPath).toBe('api.example.com/v1/users/:id');
  });

  it('queues discover until Metro hydrate so enabled paths are not blocked', async () => {
    const store = { rules: { ...projectRules }, posts: [] as unknown[] };
    const session = new DomainPathRulesSession({
      config: { mockDataPath: './mock-data', domainPathRulesMode: 'allowlist' },
      useFilesystem: false,
      fetchFn: mockMetroFetch(store),
      metroPort: 8081,
    });

    session.discover('https://api.example.com/v1/users/99');
    await session.hydrate();
    await (session as unknown as { persistQueue: Promise<void> }).persistQueue;

    const gate = session.getTrafficGate('https://api.example.com/v1/users/99');
    expect(gate.mayRecord).toBe(true);
    expect(gate.mayReplay).toBe(true);
    expect(store.rules['api.example.com'].recordResponses).toBe(true);
    expect(store.rules['api.example.com/v1/users/:id'].recordResponses).toBe(true);
  });

  it('does not treat empty {} as authoritative without Metro hydrate', async () => {
    const store = { rules: { ...projectRules }, posts: [] as unknown[] };
    const session = new DomainPathRulesSession({
      config: { mockDataPath: './mock-data', domainPathRulesMode: 'allowlist' },
      useFilesystem: false,
      fetchFn: mockMetroFetch(store),
    });

    const before = session.getTrafficGate('https://api.example.com/v1/users/1');
    expect(before.mayReplay).toBe(false);

    await session.hydrate();
    const after = session.getTrafficGate('https://api.example.com/v1/users/1');
    expect(after.mayReplay).toBe(true);
    expect(after.mayRecord).toBe(true);
  });
});

describe('isUsableNodeFsModule', () => {
  it('accepts real Node fs and rejects Metro empty stubs', () => {
    expect(isUsableNodeFsModule(fs)).toBe(true);
    expect(isUsableNodeFsModule({})).toBe(false);
    expect(isUsableNodeFsModule(null)).toBe(false);
    expect(isUsableNodeFsModule({ existsSync: () => false })).toBe(false);
  });
});

describe('DomainPathRulesSession with Metro empty fs stub', () => {
  let prevScenario: string | undefined;
  const projectRules: DomainPathRulesMap = {
    'api.example.com': { recordResponses: true, autoMock: true },
  };

  beforeEach(() => {
    prevScenario = process.env.MOCKIFYER_SCENARIO;
    process.env.MOCKIFYER_SCENARIO = 'default';
  });

  afterEach(() => {
    if (prevScenario === undefined) delete process.env.MOCKIFYER_SCENARIO;
    else process.env.MOCKIFYER_SCENARIO = prevScenario;
  });

  it('useFilesystem:false hydrates project rules via Metro (RN Hybrid path)', async () => {
    const store = { rules: { ...projectRules }, posts: [] as unknown[] };
    const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.includes('/mockifyer-domain-path-rules') && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, rules: store.rules }),
          text: async () => '',
        } as Response;
      }
      throw new Error(`Unexpected fetch: ${method} ${url}`);
    }) as typeof fetch;

    const session = new DomainPathRulesSession({
      config: { mockDataPath: './mock-data', domainPathRulesMode: 'allowlist' },
      useFilesystem: false,
      fetchFn,
    });
    await session.hydrate();
    const gate = session.getTrafficGate('https://api.example.com/v1');
    expect(gate.mayRecord).toBe(true);
    expect(gate.mayReplay).toBe(true);
  });
});

describe('envRecordResponsesOverride', () => {
  const key = 'MOCKIFYER_RECORD_RESPONSES';
  let prev: string | undefined;

  beforeEach(() => {
    prev = process.env[key];
  });

  afterEach(() => {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  });

  it('wins over path rules when set', () => {
    process.env[key] = 'false';
    const resolved = resolveRecordResponsesForRequest({
      url: 'https://api.example.com/v1',
      pathRules: { 'api.example.com': { recordResponses: true } },
      fromBody: true,
    });
    expect(resolved.recordResponses).toBe(false);
    expect(envRecordResponsesOverride()).toBe(false);
  });
});
