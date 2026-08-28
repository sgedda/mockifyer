import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { MockifyerConfig } from '../types';
import {
  getCrashContext,
  logCompactIncidentToConsole,
  reportIncident,
  type CrashContext,
} from '../utils/incidents';
import { MockifyerCrashFallback } from './MockifyerHopList';

export interface MockifyerErrorBoundaryProps {
  children: ReactNode;
  fallback?: (props: { error: Error; crashContext: CrashContext | null; incidentId: string | null }) => ReactNode;
  scenario?: string;
  clientId?: string;
  sessionId?: string;
  config?: Pick<MockifyerConfig, 'networkLog' | 'proxy'>;
  windowMs?: number;
  /** Cross-session prefetch lookback when sessionId is set. Default 5000ms; 0 to disable. */
  prefetchGraceMs?: number;
  /** Log a one-line error + collapsed hop group to console (Metro / browser). Default true. */
  logToConsole?: boolean;
  /** Hops shown in default fallback before “Show all”. Default 8. */
  visibleHopCount?: number;
}

export interface MockifyerErrorBoundaryState {
  error: Error | null;
  crashContext: CrashContext | null;
  incidentId: string | null;
}

/**
 * React ErrorBoundary that reports a Mockifyer incident and shows recent hops.
 * Forensics panel never throws — if context lookup fails, the React error still renders.
 */
export class MockifyerErrorBoundary extends Component<
  MockifyerErrorBoundaryProps,
  MockifyerErrorBoundaryState
> {
  state: MockifyerErrorBoundaryState = {
    error: null,
    crashContext: null,
    incidentId: null,
  };

  static getDerivedStateFromError(error: Error): Partial<MockifyerErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    try {
      const incident = reportIncident(
        {
          type: 'error_boundary',
          message: error.message,
          stack: error.stack,
          componentStack: info.componentStack ?? undefined,
          sessionId: this.props.sessionId ?? null,
          clientId: this.props.clientId ?? null,
          scenario: this.props.scenario,
        },
        {
          config: this.props.config,
          scenario: this.props.scenario,
          clientId: this.props.clientId,
          sessionId: this.props.sessionId,
          postToDashboard: true,
        }
      );

      const crashContext = getCrashContext({
        incidentId: incident.id,
        sessionId: this.props.sessionId ?? incident.sessionId,
        clientId: this.props.clientId ?? incident.clientId,
        at: incident.timestamp,
        windowMs: this.props.windowMs,
        prefetchGraceMs: this.props.prefetchGraceMs,
      });

      this.setState({ crashContext, incidentId: incident.id });

      if (this.props.logToConsole !== false) {
        logCompactIncidentToConsole({
          error,
          incidentId: incident.id,
          crashContext: crashContext ?? undefined,
        });
      }
    } catch {
      // observability must never break the boundary
    }
  }

  render(): ReactNode {
    const { error, crashContext, incidentId } = this.state;
    if (error) {
      if (this.props.fallback) {
        return this.props.fallback({ error, crashContext, incidentId });
      }
      return (
        <MockifyerCrashFallback
          error={error}
          crashContext={crashContext}
          incidentId={incidentId}
          visibleHopCount={this.props.visibleHopCount}
        />
      );
    }
    return this.props.children;
  }
}

export { MockifyerHopList, MockifyerCrashFallback } from './MockifyerHopList';
