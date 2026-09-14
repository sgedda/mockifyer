import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  activeOverrideGroupHasEntry,
  applyActiveOverrideGroupOverlays,
  buildClientResponseFromLiveCapture,
  ensureOverrideGroupEntry,
  hydrateOverrideGroupRuntimeFromScenarioPath,
  mockShouldBeIncludedInRequestMatch,
  prepareMockResponseBody,
  resetOverrideGroupRuntime,
  setActiveOverrideGroup,
  writeClientOverrideGroupConfig,
  writeOverrideGroupConfig,
  writeOverrideGroupToDisk,
  type MockData,
  type MockOverrideGroup,
} from '@sgedda/mockifyer-core';

function makePassthroughMock(data: unknown): MockData {
  return {
    request: { method: 'GET', url: 'https://api.example.com/bookings', headers: {} },
    response: { status: 200, data, headers: {} },
    timestamp: new Date().toISOString(),
    alwaysUseRealApi: true,
  };
}

describe('override groups', () => {
  let dir: string;
  let scenarioPath: string;

  beforeEach(() => {
    resetOverrideGroupRuntime();
    delete process.env.MOCKIFYER_OVERRIDE_GROUP;
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-og-'));
    scenarioPath = path.join(dir, 'default');
    fs.mkdirSync(scenarioPath, { recursive: true });
  });

  afterEach(() => {
    resetOverrideGroupRuntime();
    delete process.env.MOCKIFYER_OVERRIDE_GROUP;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('hydrates active group and applies overlays after mock-level fields', () => {
    const group: MockOverrideGroup = {
      id: 'check-in-open',
      label: 'Check-in open',
      updatedAt: new Date().toISOString(),
      entries: [
        {
          filename: 'bookings.json',
          responseFieldOverrides: [{ path: 'status', value: 'OPEN' }],
        },
      ],
    };
    writeOverrideGroupToDisk(scenarioPath, group);
    writeOverrideGroupConfig(scenarioPath, { currentGroup: 'check-in-open' });
    hydrateOverrideGroupRuntimeFromScenarioPath(scenarioPath);

    const mockData: MockData = {
      request: { method: 'GET', url: 'https://api.example.com/bookings', headers: {} },
      response: { status: 200, data: { status: 'CLOSED', code: 'X' }, headers: {} },
      timestamp: new Date().toISOString(),
      responseFieldOverrides: [{ path: 'code', value: 'Y' }],
    };

    const body = prepareMockResponseBody(mockData, () => new Date('2026-01-01T00:00:00.000Z'), {
      filename: 'bookings.json',
      scenarioPath,
    }) as { status: string; code: string };

    expect(body).toEqual({ status: 'OPEN', code: 'Y' });
  });

  it('prefers per-lane selection over scenario default', () => {
    const openGroup: MockOverrideGroup = {
      id: 'check-in-open',
      label: 'Open',
      updatedAt: new Date().toISOString(),
      entries: [
        {
          filename: 'bookings.json',
          responseFieldOverrides: [{ path: 'status', value: 'OPEN' }],
        },
      ],
    };
    const awardGroup: MockOverrideGroup = {
      id: 'award-trip',
      label: 'Award',
      updatedAt: new Date().toISOString(),
      entries: [
        {
          filename: 'bookings.json',
          responseFieldOverrides: [{ path: 'status', value: 'AWARD' }],
        },
      ],
    };
    writeOverrideGroupToDisk(scenarioPath, openGroup);
    writeOverrideGroupToDisk(scenarioPath, awardGroup);
    writeOverrideGroupConfig(scenarioPath, { currentGroup: 'check-in-open' });
    writeClientOverrideGroupConfig(scenarioPath, 'dev-alice', { currentGroup: 'award-trip' });

    const alice = hydrateOverrideGroupRuntimeFromScenarioPath(scenarioPath, {
      clientId: 'dev-alice',
    });
    expect(alice.source).toBe('lane');
    expect(alice.currentGroup).toBe('award-trip');
    expect(alice.defaultGroup).toBe('check-in-open');

    const bob = hydrateOverrideGroupRuntimeFromScenarioPath(scenarioPath, {
      clientId: 'dev-bob',
    });
    expect(bob.source).toBe('default');
    expect(bob.currentGroup).toBe('check-in-open');

    const mockData: MockData = {
      request: { method: 'GET', url: 'https://api.example.com/bookings', headers: {} },
      response: { status: 200, data: { status: 'CLOSED' }, headers: {} },
      timestamp: new Date().toISOString(),
    };

    hydrateOverrideGroupRuntimeFromScenarioPath(scenarioPath, { clientId: 'dev-alice' });
    expect(
      prepareMockResponseBody(mockData, () => new Date(), {
        filename: 'bookings.json',
        scenarioPath,
        overrideGroupId: 'award-trip',
      })
    ).toEqual({ status: 'AWARD' });

    expect(
      prepareMockResponseBody(mockData, () => new Date(), {
        filename: 'bookings.json',
        scenarioPath,
        overrideGroupId: 'check-in-open',
      })
    ).toEqual({ status: 'OPEN' });
  });

  it('includes passthrough mocks when only the active group has overlays', () => {
    const group: MockOverrideGroup = {
      id: 'award',
      label: 'Award',
      updatedAt: new Date().toISOString(),
      entries: [
        {
          filename: 'trip.json',
          responseFieldOverrides: [{ path: 'eligible', value: true }],
        },
      ],
    };
    writeOverrideGroupToDisk(scenarioPath, group);
    writeOverrideGroupConfig(scenarioPath, { currentGroup: 'award' });
    hydrateOverrideGroupRuntimeFromScenarioPath(scenarioPath);

    const passthrough = makePassthroughMock({ eligible: false });
    expect(mockShouldBeIncludedInRequestMatch(passthrough)).toBe(false);
    expect(
      mockShouldBeIncludedInRequestMatch(passthrough, {
        filename: 'trip.json',
        scenarioPath,
      })
    ).toBe(true);
    expect(activeOverrideGroupHasEntry('trip.json', scenarioPath)).toBe(true);
  });

  it('applies group overlays on live capture when mock has none', () => {
    const group: MockOverrideGroup = {
      id: 'live',
      label: 'Live',
      updatedAt: new Date().toISOString(),
      entries: [
        {
          filename: 'live.json',
          responseFieldOverrides: [{ path: 'flag', value: 1 }],
        },
      ],
    };
    writeOverrideGroupToDisk(scenarioPath, group);
    writeOverrideGroupConfig(scenarioPath, { currentGroup: 'live' });
    hydrateOverrideGroupRuntimeFromScenarioPath(scenarioPath);

    const mockData = makePassthroughMock({ flag: 0 });
    const client = buildClientResponseFromLiveCapture(
      mockData,
      { status: 200, data: { flag: 0 }, headers: {} },
      () => new Date(),
      { filename: 'live.json', scenarioPath }
    );
    expect(client.data).toEqual({ flag: 1 });
  });

  it('ensureOverrideGroupEntry keeps empty entries; clearing active drops overlays', () => {
    let group: MockOverrideGroup = {
      id: 'g1',
      label: 'G1',
      updatedAt: new Date().toISOString(),
      entries: [],
    };
    group = ensureOverrideGroupEntry(group, 'a.json');
    expect(group.entries).toHaveLength(1);
    writeOverrideGroupToDisk(scenarioPath, group);
    writeOverrideGroupConfig(scenarioPath, { currentGroup: 'g1' });
    hydrateOverrideGroupRuntimeFromScenarioPath(scenarioPath);
    expect(activeOverrideGroupHasEntry('a.json', scenarioPath)).toBe(false);

    setActiveOverrideGroup(null, scenarioPath);
    expect(
      applyActiveOverrideGroupOverlays({ x: 1 }, 'a.json', () => new Date(), scenarioPath)
    ).toEqual({ x: 1 });
  });
});
