import {
  endpointUrlToDomainPath,
  findLongestDomainPathRule,
  findLongestDomainPathRuleForFolder,
  resolveRecordResponsesForRequest,
  envRecordResponsesOverride,
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
