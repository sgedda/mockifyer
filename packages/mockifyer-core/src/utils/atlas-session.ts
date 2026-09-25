/**
 * Session snapshot read by screenshot capture.
 * Kept out of `atlas.ts` so `atlas-screenshot.ts` does not import `atlas.ts`
 * (that pair is a require cycle: atlas also imports the screenshot module).
 */

let enabled = false;
let sessionId: string | null = null;

/** Mirror Atlas runtime mode and session id after `atlas.ts` mutates them. */
export function syncAtlasSessionSnapshot(next: {
  mode: string;
  sessionId: string | null;
}): void {
  enabled = next.mode !== 'off';
  sessionId = next.sessionId;
}

export function isAtlasEnabled(): boolean {
  return enabled;
}

export function getAtlasSessionId(): string | null {
  return sessionId;
}
