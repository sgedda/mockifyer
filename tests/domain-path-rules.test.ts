import {
  collapseDomainPathIdSegments,
  discoverDomainPathRulesForUrl,
  endpointUrlToDomainPath,
  findLongestDomainPathRule,
  findLongestDomainPathRuleForFolder,
  mergeDomainPathRuleUpserts,
  mergeDiscoveredDomainPathRules,
  normalizeDomainPathForDiscovery,
  resolveDomainPathRulesMode,
  resolveDomainPathTrafficGate,
  resolveRecordResponsesForRequest,
  envRecordResponsesOverride,
  upsertDiscoveredDomainPathRule,
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
