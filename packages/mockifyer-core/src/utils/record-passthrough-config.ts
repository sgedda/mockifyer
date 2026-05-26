import type { MockData, MockifyerConfig } from '../types';
import { ENV_VARS } from '../types';
import { mockPassesThroughToRealApi } from './mock-passthrough';

function parseBoolEnv(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw === '') return undefined;
  const v = String(raw).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'off'].includes(v)) return false;
  return undefined;
}

/**
 * When true, newly recorded mocks are saved with {@link MockData.alwaysUseRealApi} so they appear
 * in the dashboard but are not replayed until activated (flag cleared in the UI).
 *
 * Precedence: **`MOCKIFYER_RECORD_NEW_AS_PASSTHROUGH`** env → **`recordNewMocksAsPassthrough`** config.
 */
export function resolveRecordNewMocksAsPassthrough(
  config: Pick<MockifyerConfig, 'recordNewMocksAsPassthrough'>
): boolean {
  const fromEnv = parseBoolEnv(
    typeof process !== 'undefined' ? process.env[ENV_VARS.MOCK_RECORD_NEW_AS_PASSTHROUGH] : undefined
  );
  if (fromEnv !== undefined) return fromEnv;
  return config.recordNewMocksAsPassthrough === true;
}

/**
 * When true, existing passthrough recordings are overwritten on each real API response (same request key).
 *
 * Precedence: **`MOCKIFYER_REFRESH_PASSTHROUGH_RECORDINGS`** env → **`refreshPassthroughRecordings`** config.
 */
export function resolveRefreshPassthroughRecordings(
  config: Pick<MockifyerConfig, 'refreshPassthroughRecordings'>
): boolean {
  const fromEnv = parseBoolEnv(
    typeof process !== 'undefined'
      ? process.env[ENV_VARS.MOCK_REFRESH_PASSTHROUGH_RECORDINGS]
      : undefined
  );
  if (fromEnv !== undefined) return fromEnv;
  return config.refreshPassthroughRecordings === true;
}

export type MockRecordingSaveAction = 'skip' | 'create' | 'overwrite';

export interface MockRecordingSaveDecision {
  action: MockRecordingSaveAction;
  /** Applied on create/overwrite when recordings should stay passthrough until activated. */
  alwaysUseRealApi?: boolean;
}

/**
 * Decides whether to skip, create, or overwrite a mock file when saving a real API response.
 */
export function resolveMockRecordingSaveDecision(
  config: Pick<MockifyerConfig, 'recordNewMocksAsPassthrough' | 'refreshPassthroughRecordings'>,
  existingMock: MockData | undefined
): MockRecordingSaveDecision {
  const recordAsPassthrough = resolveRecordNewMocksAsPassthrough(config);
  const refreshPassthrough = resolveRefreshPassthroughRecordings(config);

  if (!existingMock) {
    return {
      action: 'create',
      ...(recordAsPassthrough ? { alwaysUseRealApi: true } : {}),
    };
  }

  if (mockPassesThroughToRealApi(existingMock) && refreshPassthrough) {
    return {
      action: 'overwrite',
      alwaysUseRealApi: true,
    };
  }

  return { action: 'skip' };
}

/** Sets or clears {@link MockData.alwaysUseRealApi} on mock payload before persisting. */
export function applyRecordingPassthroughFlag(mockData: MockData, alwaysUseRealApi: boolean | undefined): void {
  if (alwaysUseRealApi === true) {
    mockData.alwaysUseRealApi = true;
  }
}
