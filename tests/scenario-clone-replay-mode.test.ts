import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveMockReplayMode, type MockData } from '@sgedda/mockifyer-core';
import {
  resetReplayModeForDerivedScenario,
  resetReplayModesInScenarioFolder,
  rewriteClonedMockJson,
} from '../packages/mockifyer-dashboard/src/utils/scenario-clone-replay-mode';

function mockWithMode(mode: 'stored' | 'always-refresh' | 'passthrough'): MockData {
  return {
    request: { method: 'POST', url: 'http://localhost:4000/graphql', headers: {}, data: {} },
    response: { status: 200, data: { data: { ok: true } }, headers: {} },
    timestamp: '2026-09-17T12:00:00.000Z',
    ...(mode === 'passthrough' ? { alwaysUseRealApi: true } : {}),
    ...(mode === 'always-refresh' ? { alwaysRefreshFromLive: true } : {}),
  };
}

describe('scenario clone replay mode', () => {
  it('resets use-saved-mock and always-refresh to live API on derived copies', () => {
    const stored = mockWithMode('stored');
    resetReplayModeForDerivedScenario(stored);
    expect(resolveMockReplayMode(stored)).toBe('passthrough');
    expect(stored.response.data).toEqual({ data: { ok: true } });

    const refresh = mockWithMode('always-refresh');
    resetReplayModeForDerivedScenario(refresh);
    expect(resolveMockReplayMode(refresh)).toBe('passthrough');
    expect(refresh.alwaysRefreshFromLive).toBeUndefined();
  });

  it('rewrites cloned JSON without dropping the stored body', () => {
    const raw = JSON.stringify(mockWithMode('stored'));
    const next = rewriteClonedMockJson(raw);
    expect(next).toBeTruthy();
    const parsed = JSON.parse(next!) as MockData;
    expect(resolveMockReplayMode(parsed)).toBe('passthrough');
    expect(parsed.response.data).toEqual({ data: { ok: true } });
  });

  it('clears replay flags in a copied scenario folder but leaves date-config alone', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-clone-replay-'));
    try {
      const dest = path.join(tmp, 'derived');
      fs.mkdirSync(dest, { recursive: true });
      fs.writeFileSync(path.join(dest, 'graphql.json'), JSON.stringify(mockWithMode('stored'), null, 2));
      fs.writeFileSync(
        path.join(dest, 'date-config.json'),
        JSON.stringify({ dateManipulation: { fixedDate: '2024-01-01T00:00:00.000Z' } }, null, 2)
      );

      expect(resetReplayModesInScenarioFolder(dest)).toBe(1);

      const cloned = JSON.parse(fs.readFileSync(path.join(dest, 'graphql.json'), 'utf-8')) as MockData;
      expect(resolveMockReplayMode(cloned)).toBe('passthrough');
      const dateConfig = JSON.parse(fs.readFileSync(path.join(dest, 'date-config.json'), 'utf-8')) as {
        dateManipulation: { fixedDate: string };
      };
      expect(dateConfig.dateManipulation.fixedDate).toBe('2024-01-01T00:00:00.000Z');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
