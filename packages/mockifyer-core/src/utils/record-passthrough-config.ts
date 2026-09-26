import type { MockData, MockifyerConfig } from '../types';
import { mockPassesThroughToRealApi } from './mock-passthrough';
import {
  resolveRecordNewMocksAsPassthrough,
  resolveRefreshPassthroughRecordings,
} from './record-passthrough-env';

export {
  resolveRecordNewMocksAsPassthrough,
  resolveRefreshPassthroughRecordings,
} from './record-passthrough-env';

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
