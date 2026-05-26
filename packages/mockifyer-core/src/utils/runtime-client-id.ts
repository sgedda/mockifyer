export interface MockifyerClientIdRuntime {
  getClientId: () => string | undefined;
  setClientId: (lane: string) => void;
}

let runtime: MockifyerClientIdRuntime | null = null;

/**
 * Registers the active Mockifyer instance for module-level {@link getClientId} / {@link setClientId}.
 * Called automatically by `setupMockifyer` in fetch/axios packages.
 */
export function registerMockifyerInstance(instance: MockifyerClientIdRuntime): void {
  runtime = instance;
}

/** Clears the module-level registry (e.g. tests or teardown). */
export function clearMockifyerClientIdRuntime(): void {
  runtime = null;
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
