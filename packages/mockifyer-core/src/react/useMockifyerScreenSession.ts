import { useEffect, useMemo } from 'react';
import { setFlightRecorderRuntimeContext } from '../utils/flight-recorder';
import { popAtlasUsageContext, pushAtlasUsageContext } from '../utils/atlas-usage';

export interface UseMockifyerScreenSessionOptions {
  /** Stable screen or flow name, e.g. `matchday` or `settings-profile`. */
  screenName: string;
  clientId?: string;
  scenario?: string;
  /** Optional component/feature label stamped on outbound hops while this screen is active. */
  component?: string;
}

/**
 * Per-screen session id for crash forensics — ties ErrorBoundary incidents and
 * subsequent network hops to the same bucket (via {@link setFlightRecorderRuntimeContext}).
 *
 * Also pushes {@link pushAtlasUsageContext} so network events are auto-tagged with this screen
 * (trace spine + "used by" in the dashboard). Nested screens restore the parent context on unmount.
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
    pushAtlasUsageContext({
      screen: options.screenName.trim(),
      component: options.component,
    });

    return () => {
      setFlightRecorderRuntimeContext({
        sessionId: undefined,
        clientId: undefined,
        scenario: undefined,
      });
      popAtlasUsageContext();
    };
  }, [sessionId, options.clientId, options.scenario, options.screenName, options.component]);

  return sessionId;
}
