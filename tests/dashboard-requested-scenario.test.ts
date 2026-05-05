import fs from 'fs';
import os from 'os';
import path from 'path';
import { resolveRequestedScenario } from '../packages/mockifyer-dashboard/src/utils/requested-scenario';

describe('dashboard requested scenario resolution', () => {
  let mockDataPath: string;

  beforeEach(() => {
    mockDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-scenario-'));
    fs.writeFileSync(
      path.join(mockDataPath, 'scenario-config.json'),
      JSON.stringify({ currentScenario: 'active' }),
      'utf-8'
    );
  });

  afterEach(() => {
    fs.rmSync(mockDataPath, { recursive: true, force: true });
  });

  it('uses explicit scenario instead of active scenario', () => {
    expect(resolveRequestedScenario(mockDataPath, 'listed')).toEqual({ scenario: 'listed' });
  });

  it('falls back to active scenario when no scenario is requested', () => {
    expect(resolveRequestedScenario(mockDataPath, undefined)).toEqual({ scenario: 'active' });
  });

  it('rejects malformed scenario names instead of falling back', () => {
    expect(resolveRequestedScenario(mockDataPath, '../active')).toEqual({
      error: 'Invalid scenario name: "../active". Use only letters, numbers, hyphens, and underscores.',
    });
  });

  it('rejects repeated scenario parameters instead of falling back', () => {
    expect(resolveRequestedScenario(mockDataPath, ['listed', 'active'])).toEqual({
      error: 'Scenario must be a single string',
    });
  });
});
