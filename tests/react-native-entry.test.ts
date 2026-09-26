import fs from 'fs';
import path from 'path';
import { ENV_VARS } from '@sgedda/mockifyer-core';
import {
  arePoolRefsEnabled,
  collectPoolRefIds,
  containsPoolRefs,
  createServeTimePoolResponseLoader,
  isUsableNodeLikePoolFs,
  loadPersistedRuntimeEnabled,
  resolveRuntimeEnabledStorage,
  scheduleRuntimeDateSyncFromConfig,
  shouldActivateMockifyerForReactNative,
  tryGetScenarioFromLaunchArguments,
  buildAtlasLiveStreamHtml,
  ATLAS_LIVE_STREAM_PATH,
  replayNetworkEventWithIncludeTrace,
  ATLAS_TRACE_REPLAY_PATH,
  isMetroAtlasCaptureSessionActive,
  setMetroAtlasCaptureSessionActive,
  ATLAS_CAPTURE_SESSION_PATH,
  MOCKIFYER_METRO_STREAM_BASE_HEADER,
  sanitizeAtlasMetroStreamBaseUrl,
  normalizeDashboardBaseUrl,
  pullDashboardDescendantsForParents,
  selectNewDashboardDescendantHops,
  appendParamsToUrl,
  resolveNetworkEventReplayUrl,
} from '../packages/mockifyer-core/src/index.react-native';
import {
  ENV_VARS as ENV_VARS_FROM_RN_ENTRY,
  setupMockifyer,
  setupMockifyerForReactNative,
} from '../packages/mockifyer-fetch/src/react-native';

describe('mockifyer-fetch React Native entry', () => {
  it('preserves package-root exports when the react-native condition is selected', () => {
    expect(typeof setupMockifyer).toBe('function');
    expect(typeof setupMockifyerForReactNative).toBe('function');
    expect(ENV_VARS_FROM_RN_ENTRY).toBe(ENV_VARS);
  });

  it('exports Metro-called helpers that live outside the Node-only modules', () => {
    expect(typeof scheduleRuntimeDateSyncFromConfig).toBe('function');
    expect(typeof createServeTimePoolResponseLoader).toBe('function');
    expect(typeof isUsableNodeLikePoolFs).toBe('function');
    expect(typeof arePoolRefsEnabled).toBe('function');
    expect(typeof containsPoolRefs).toBe('function');
    expect(typeof collectPoolRefIds).toBe('function');
    expect(typeof buildAtlasLiveStreamHtml).toBe('function');
    expect(ATLAS_LIVE_STREAM_PATH).toBe('/mockifyer-atlas-live');
    expect(typeof replayNetworkEventWithIncludeTrace).toBe('function');
    expect(ATLAS_TRACE_REPLAY_PATH).toBe('/mockifyer-atlas-trace');
    expect(typeof isMetroAtlasCaptureSessionActive).toBe('function');
    expect(typeof setMetroAtlasCaptureSessionActive).toBe('function');
    expect(ATLAS_CAPTURE_SESSION_PATH).toBe('/mockifyer-atlas-capture');
    expect(MOCKIFYER_METRO_STREAM_BASE_HEADER).toBe(
      'x-mockifyer-metro-stream-base'
    );
    expect(typeof sanitizeAtlasMetroStreamBaseUrl).toBe('function');
    expect(typeof normalizeDashboardBaseUrl).toBe('function');
    expect(typeof pullDashboardDescendantsForParents).toBe('function');
    expect(typeof selectNewDashboardDescendantHops).toBe('function');
    expect(typeof appendParamsToUrl).toBe('function');
    expect(typeof resolveNetworkEventReplayUrl).toBe('function');
  });

  it('keeps dynamic require() out of the Metro sibling-setup entry', () => {
    const source = fs.readFileSync(
      path.join(
        __dirname,
        '../packages/mockifyer-core/src/utils/load-sibling-setup.native.ts'
      ),
      'utf8'
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/require\s*\(/);
    expect(code).not.toContain('@sgedda/mockifyer-axios');
    expect(code).not.toContain('@sgedda/mockifyer-fetch');
  });

  it('re-exports the helpers setupMockifyerForReactNative calls on device', () => {
    expect(typeof resolveRuntimeEnabledStorage).toBe('function');
    expect(typeof loadPersistedRuntimeEnabled).toBe('function');
    expect(typeof shouldActivateMockifyerForReactNative).toBe('function');
    expect(typeof tryGetScenarioFromLaunchArguments).toBe('function');
  });
});
