import {
  isMockRecordingSidecarDir,
  isOverrideGroupConfigFilename,
  MOCK_RECORDING_SIDECAR_DIR_NAMES,
  OVERRIDE_GROUPS_DIR_NAME,
  OVERRIDE_SETS_DIR_NAME,
  POOL_DIR_NAME,
} from '@sgedda/mockifyer-core';

describe('mock recording sidecar layout', () => {
  it('treats override-groups, override-sets, and pool as sidecar directories', () => {
    expect(MOCK_RECORDING_SIDECAR_DIR_NAMES).toEqual(
      expect.arrayContaining([OVERRIDE_GROUPS_DIR_NAME, OVERRIDE_SETS_DIR_NAME, POOL_DIR_NAME])
    );
    expect(isMockRecordingSidecarDir('override-groups')).toBe(true);
    expect(isMockRecordingSidecarDir('override-sets')).toBe(true);
    expect(isMockRecordingSidecarDir('pool')).toBe(true);
    expect(isMockRecordingSidecarDir('graphql')).toBe(false);
  });

  it('recognizes override-group config pointers', () => {
    expect(isOverrideGroupConfigFilename('override-group-config.json')).toBe(true);
    expect(isOverrideGroupConfigFilename('override-group-config.dev-alice.json')).toBe(true);
    expect(isOverrideGroupConfigFilename('bookings.json')).toBe(false);
  });
});
