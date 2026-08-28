import { useEffect, useMemo } from 'react';
import { setFlightRecorderRuntimeContext } from '../utils/flight-recorder';

export interface UseMockifyerScreenSessionOptions {
  /** Stable screen or flow name, e.g. `matchday` or `settings-profile`. */
  screenName: string;
  clientId?: string;
  scenario?: string;
}

/**
 * Per-screen session id for crash forensics — ties ErrorBoundary incidents and
 * subsequent network hops to the same bucket (via {@link setFlightRecorderRuntimeContext}).
 *
 * Use the returned `sessionId` on {@link MockifyerErrorBoundary} for the same screen.
 */
export function useMockifyerScreenSession(options: UseMockifyerScreenSessionOptions): string {
  const sessionId = useMemo(() => {
    const slug = options.screenName.trim().replace(/\s+/g, '-').toLowerCase() || 'screen';
    return `screen-${slug}-${Date.now()}`;
  }, [options.screenName]);

  useEffect(() => {
    setFlightRecorderRuntimeContext({
      sessionId,
      clientId: options.clientId,
      scenario: options.scenario,
    });
  }, [sessionId, options.clientId, options.scenario]);

  return sessionId;
}
