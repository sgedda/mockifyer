import {
  ENV_VARS,
  resolveMockRecordingSaveDecision,
  resolveRecordNewMocksAsPassthrough,
  resolveRefreshPassthroughRecordings,
} from '@sgedda/mockifyer-core';
import type { MockData } from '@sgedda/mockifyer-core';

function baseMock(overrides: Partial<MockData> = {}): MockData {
  return {
    request: { method: 'GET', url: 'https://api.example.com/users', headers: {} },
    response: { status: 200, data: {}, headers: {} },
    timestamp: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('record-passthrough-config', () => {
  const recordEnvKey = ENV_VARS.MOCK_RECORD_NEW_AS_PASSTHROUGH;
  const refreshEnvKey = ENV_VARS.MOCK_REFRESH_PASSTHROUGH_RECORDINGS;

  afterEach(() => {
    delete process.env[recordEnvKey];
    delete process.env[refreshEnvKey];
  });

  describe('resolveRecordNewMocksAsPassthrough', () => {
    it('defaults to false', () => {
      expect(resolveRecordNewMocksAsPassthrough({})).toBe(false);
    });

    it('reads config when env unset', () => {
      expect(resolveRecordNewMocksAsPassthrough({ recordNewMocksAsPassthrough: true })).toBe(true);
    });

    it('env wins over config', () => {
      process.env[recordEnvKey] = 'false';
      expect(
        resolveRecordNewMocksAsPassthrough({ recordNewMocksAsPassthrough: true })
      ).toBe(false);
    });
  });

  describe('resolveRefreshPassthroughRecordings', () => {
    it('defaults to false', () => {
      expect(resolveRefreshPassthroughRecordings({})).toBe(false);
    });

    it('env wins over config', () => {
      process.env[refreshEnvKey] = 'true';
      expect(resolveRefreshPassthroughRecordings({ refreshPassthroughRecordings: false })).toBe(
        true
      );
    });
  });

  describe('resolveMockRecordingSaveDecision', () => {
    it('creates with alwaysUseRealApi when recordNewMocksAsPassthrough is on', () => {
      expect(
        resolveMockRecordingSaveDecision({ recordNewMocksAsPassthrough: true }, undefined)
      ).toEqual({ action: 'create', alwaysUseRealApi: true });
    });

    it('creates without flag when passthrough default is off', () => {
      expect(resolveMockRecordingSaveDecision({}, undefined)).toEqual({ action: 'create' });
    });

    it('skips when active mock exists', () => {
      expect(resolveMockRecordingSaveDecision({}, baseMock())).toEqual({ action: 'skip' });
    });

    it('skips when passthrough mock exists and refresh is off', () => {
      expect(
        resolveMockRecordingSaveDecision({}, baseMock({ alwaysUseRealApi: true }))
      ).toEqual({ action: 'skip' });
    });

    it('overwrites passthrough mock when refresh is on', () => {
      expect(
        resolveMockRecordingSaveDecision(
          { refreshPassthroughRecordings: true },
          baseMock({ alwaysUseRealApi: true })
        )
      ).toEqual({ action: 'overwrite', alwaysUseRealApi: true });
    });
  });
});
