import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  DEFAULT_OVERRIDE_SET_ID,
  applyOverrideSetDocumentToMock,
  applyOverrideSetEntryToMock,
  createEmptyOverrideSetDocument,
  normalizeOverrideSetId,
  overrideSetEntryHashForMock,
  parseOverrideSetDocument,
  upsertOverrideSetEntry,
  writeOverrideSetToFs,
  type MockData,
} from '@sgedda/mockifyer-core';

function baseMock(status: string): MockData {
  return {
    request: {
      method: 'GET',
      url: 'https://api.example.com/trip',
      headers: {},
    },
    response: {
      status: 200,
      headers: {},
      data: { trip: { status, seats: 2 } },
    },
    timestamp: new Date().toISOString(),
  };
}

describe('override sets', () => {
  it('normalizes empty id to default', () => {
    expect(normalizeOverrideSetId(undefined)).toBe(DEFAULT_OVERRIDE_SET_ID);
    expect(normalizeOverrideSetId('')).toBe(DEFAULT_OVERRIDE_SET_ID);
    expect(normalizeOverrideSetId('delayed-departure')).toBe('delayed-departure');
  });

  it('rejects invalid override set ids', () => {
    expect(() => normalizeOverrideSetId('../evil')).toThrow(/Invalid override set id/);
  });

  it('merges set entry over mock-embedded overrides by path', () => {
    const mock: MockData = {
      ...baseMock('ON_TIME'),
      responseFieldOverrides: [
        { path: 'trip.status', value: 'ON_TIME' },
        { path: 'trip.seats', value: 2 },
      ],
    };
    const merged = applyOverrideSetEntryToMock(mock, {
      responseFieldOverrides: [{ path: 'trip.status', value: 'DELAYED' }],
    });
    expect(merged.responseFieldOverrides).toEqual(
      expect.arrayContaining([
        { path: 'trip.status', value: 'DELAYED' },
        { path: 'trip.seats', value: 2 },
      ])
    );
    expect(mock.responseFieldOverrides?.[0]?.value).toBe('ON_TIME');
  });

  it('applies document entry for matching request hash only', () => {
    const mock = baseMock('ON_TIME');
    const hash = overrideSetEntryHashForMock(mock);
    const otherHash = 'a'.repeat(64);
    const doc = createEmptyOverrideSetDocument('delayed-departure');
    const withEntries = upsertOverrideSetEntry(doc, hash, {
      responseFieldOverrides: [{ path: 'trip.status', value: 'DELAYED' }],
    });
    const withOther = upsertOverrideSetEntry(withEntries, otherHash, {
      responseFieldOverrides: [{ path: 'trip.status', value: 'CANCELLED' }],
    });

    const applied = applyOverrideSetDocumentToMock(mock, withOther);
    expect(applied.responseFieldOverrides).toEqual([
      { path: 'trip.status', value: 'DELAYED' },
    ]);
  });

  it('parses persisted documents and upserts/clears entries', () => {
    const parsed = parseOverrideSetDocument({
      id: 'default',
      entries: {
        ['b'.repeat(64)]: {
          responseFieldOverrides: [{ path: 'a', value: 1 }],
        },
      },
    });
    expect(parsed.id).toBe('default');
    expect(Object.keys(parsed.entries)).toHaveLength(1);

    const cleared = upsertOverrideSetEntry(parsed, 'b'.repeat(64), null);
    expect(Object.keys(cleared.entries)).toHaveLength(0);
  });

  it('refuses to write override-set files outside mockDataPath via scenario traversal', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mockifyer-oset-'));
    const mockDataPath = path.join(tmp, 'mock-data');
    fs.mkdirSync(mockDataPath, { recursive: true });
    const doc = createEmptyOverrideSetDocument(DEFAULT_OVERRIDE_SET_ID);

    expect(() => writeOverrideSetToFs(mockDataPath, '..', doc)).toThrow(/Invalid scenario name/);
    expect(() => writeOverrideSetToFs(mockDataPath, '../evil', doc)).toThrow(/Invalid scenario name/);
    expect(() => writeOverrideSetToFs(mockDataPath, 'foo/bar', doc)).toThrow(/Invalid scenario name/);

    const escaped = path.join(tmp, 'override-sets', `${DEFAULT_OVERRIDE_SET_ID}.json`);
    expect(fs.existsSync(escaped)).toBe(false);
    expect(fs.readdirSync(tmp)).toEqual(['mock-data']);

    writeOverrideSetToFs(mockDataPath, 'default', doc);
    expect(
      fs.existsSync(path.join(mockDataPath, 'default', 'override-sets', `${DEFAULT_OVERRIDE_SET_ID}.json`))
    ).toBe(true);

    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
