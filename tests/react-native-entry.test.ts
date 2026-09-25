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
    expect(code).not.toMatch(/require\s*\(\s*[A-Za-z_$]/);
    expect(source).toContain("require(/* webpackIgnore: true */ '@sgedda/mockifyer-axios')");
    expect(source).toContain("require(/* webpackIgnore: true */ '@sgedda/mockifyer-fetch')");
  });

  it('re-exports the helpers setupMockifyerForReactNative calls on device', () => {
    expect(typeof resolveRuntimeEnabledStorage).toBe('function');
    expect(typeof loadPersistedRuntimeEnabled).toBe('function');
    expect(typeof shouldActivateMockifyerForReactNative).toBe('function');
    expect(typeof tryGetScenarioFromLaunchArguments).toBe('function');
  });
});
