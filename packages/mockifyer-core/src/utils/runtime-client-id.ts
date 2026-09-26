import {
  setRegisteredMockifyerRuntimeToggle,
  startMetroAtlasRuntimeSync,
  stopMetroAtlasRuntimeSync,
} from './metro-atlas-runtime-sync';

export interface MockifyerClientIdRuntime {
  getClientId: () => string | undefined;
  setClientId: (lane: string) => void;
  /** Optional — used by Metro Atlas (`t`) to auto-enable when capture starts. */
  enableMockifyer?: () => void;
  /** Optional — skip enable when already on. */
  isMockifyerEnabled?: () => boolean;
}

let runtime: MockifyerClientIdRuntime | null = null;

/**
 * Registers the active Mockifyer instance for module-level {@link getClientId} / {@link setClientId}.
 * Called automatically by `setupMockifyer` in fetch/axios packages, and again by dual-client
 * presets after sync so the registry points at the primary (synced) instance.
 * When enable APIs are present, also wires Metro Atlas (`t`) → runtime enable sync.
 */
export function registerMockifyerInstance(instance: MockifyerClientIdRuntime): void {
  runtime = instance;
  if (typeof instance.enableMockifyer === 'function') {
    setRegisteredMockifyerRuntimeToggle(instance);
    startMetroAtlasRuntimeSync();
  }
}

/** Clears the module-level registry (e.g. tests or teardown). */
export function clearMockifyerClientIdRuntime(): void {
  runtime = null;
  stopMetroAtlasRuntimeSync();
}

/**
 * Returns the current client lane from the last registered Mockifyer instance.
 * Returns `undefined` if Mockifyer has not been set up (or runtime was cleared).
 */
export function getClientId(): string | undefined {
  return runtime?.getClientId();
}

/**
 * Updates the client lane on the registered Mockifyer instance.
 * @throws If Mockifyer has not been set up via `setupMockifyer`.
 */
export function setClientId(lane: string): void {
  if (!runtime) {
    throw new Error(
      '[Mockifyer] setClientId: Mockifyer is not initialized. Call setupMockifyer (or setupMockifyerForReactNative) first.'
    );
  }
  runtime.setClientId(lane);
}
