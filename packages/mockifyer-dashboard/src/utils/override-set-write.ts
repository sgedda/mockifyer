import {
  DEFAULT_OVERRIDE_SET_ID,
  createEmptyOverrideSetDocument,
  normalizeOverrideSetId,
  overrideSetEntryHashForMock,
  readOverrideSetFromFs,
  upsertOverrideSetEntry,
  writeOverrideSetToFs,
  type MockData,
  type OverrideSetEntry,
} from '@sgedda/mockifyer-core';
import type { RedisMockStore } from './redis-mock-store';

export interface WriteMockOverridesToSetParams {
  mockDataPath: string;
  scenario: string;
  mockData: MockData;
  filename?: string;
  overrideSetId?: string | null;
  /** When set, use Redis/SQLite store instead of filesystem. */
  store?: RedisMockStore | null;
  fieldOverrides?: OverrideSetEntry['responseFieldOverrides'];
  dateOverrides?: OverrideSetEntry['responseDateOverrides'];
  /** If true, clear the entry when both override arrays are empty/null. */
  clearIfEmpty?: boolean;
}

/**
 * Persist mock field/date overrides into a named override set (default: `default`).
 * Shared scenario mocks stay as underlying data; clients pick which set to apply.
 */
export async function writeMockOverridesToOverrideSet(
  params: WriteMockOverridesToSetParams
): Promise<{ setId: string; hash: string }> {
  const setId = normalizeOverrideSetId(params.overrideSetId ?? DEFAULT_OVERRIDE_SET_ID);
  const hash = overrideSetEntryHashForMock(params.mockData);
  const field = params.fieldOverrides;
  const dates = params.dateOverrides;
  const empty =
    (field == null || field.length === 0) && (dates == null || dates.length === 0);
  const entry: OverrideSetEntry | null =
    params.clearIfEmpty && empty
      ? null
      : {
          ...(field && field.length ? { responseFieldOverrides: field } : {}),
          ...(dates && dates.length ? { responseDateOverrides: dates } : {}),
          ...(params.filename ? { filename: params.filename } : {}),
        };

  if (params.store) {
    const current = await params.store.getOverrideSet(params.scenario, setId);
    const next = upsertOverrideSetEntry(current, hash, entry);
    await params.store.putOverrideSet(params.scenario, next);
  } else {
    const current = readOverrideSetFromFs(params.mockDataPath, params.scenario, setId);
    const next = upsertOverrideSetEntry(current, hash, entry);
    writeOverrideSetToFs(params.mockDataPath, params.scenario, next);
  }
  return { setId, hash };
}
