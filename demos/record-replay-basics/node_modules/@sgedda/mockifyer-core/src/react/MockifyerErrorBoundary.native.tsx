import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { MockifyerConfig } from '../types';
import {
  exportCrashContextHtmlLocal,
  getCrashContext,
  logCompactIncidentToConsole,
  reportIncident,
  resolveCrashContextUrl,
  type CrashContext,
  type LocalCrashTraceLinks,
} from '../utils/incidents';
import { resolveForensicsDashboardBaseUrl } from '../utils/network-log';
import type { MockifyerErrorBoundaryProps, MockifyerErrorBoundaryState } from './MockifyerErrorBoundary';
import { MockifyerCrashFallback } from './MockifyerHopList.native';

export type { MockifyerErrorBoundaryProps, MockifyerErrorBoundaryState };

/**
 * React Native ErrorBoundary — uses View/Text fallback via explicit `.native` import
 * so Metro never resolves the web HTML bundle from pre-built dist.
 */
export class MockifyerErrorBoundary extends Component<
  MockifyerErrorBoundaryProps,
  MockifyerErrorBoundaryState
> {
  state: MockifyerErrorBoundaryState = {
    error: null,
    crashContext: null,
    incidentId: null,
    dashboardExplainUrl: null,
    localTrace: null,
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

      const dashboardBaseUrl = resolveForensicsDashboardBaseUrl(this.props.config ?? {});
      const linkParams = {
        incidentId: incident.id,
        sessionId: this.props.sessionId ?? incident.sessionId ?? undefined,
        at: incident.timestamp,
        windowMs: this.props.windowMs ?? crashContext?.windowMs,
      };
      const dashboardExplainUrl = dashboardBaseUrl
        ? resolveCrashContextUrl(dashboardBaseUrl, linkParams)
        : null;

      this.setState({
        crashContext,
        incidentId: incident.id,
        dashboardExplainUrl,
        localTrace: null,
      });

      void this.exportAndLogForensics(error, incident.id, crashContext, dashboardExplainUrl);
    } catch {
      // observability must never break the boundary
    }
  }

  private async exportAndLogForensics(
    error: Error,
    incidentId: string,
    crashContext: CrashContext | null,
    dashboardExplainUrl: string | null
  ): Promise<void> {
    try {
      let localTrace: LocalCrashTraceLinks | null = null;
      if (crashContext && crashContext.hops.length > 0) {
        localTrace = await exportCrashContextHtmlLocal({
          crashContext,
          incidentId,
          errorMessage: error.message,
          mockDataPath: this.props.mockDataPath,
        });
        if (localTrace) {
          this.setState({ localTrace });
        }
      }

      if (this.props.logToConsole !== false) {
        logCompactIncidentToConsole({
          error,
          incidentId,
          crashContext: crashContext ?? undefined,
          dashboardExplainUrl: dashboardExplainUrl ?? undefined,
          localTrace,
        });
      }
    } catch {
      // observability must never break the boundary
    }
  }

  render(): ReactNode {
    const { error, crashContext, incidentId, dashboardExplainUrl, localTrace } = this.state;
    if (error) {
      if (this.props.fallback) {
        return this.props.fallback({ error, crashContext, incidentId });
      }
      return (
        <MockifyerCrashFallback
          error={error}
          crashContext={crashContext}
          incidentId={incidentId}
          dashboardExplainUrl={dashboardExplainUrl ?? undefined}
          localTraceBrowseUrl={localTrace?.browseUrl ?? localTrace?.fileUrl}
          localTraceFileHint={localTrace?.relativePath}
          visibleHopCount={this.props.visibleHopCount}
        />
      );
    }
    return this.props.children;
  }
}

export { MockifyerHopList, MockifyerCrashFallback } from './MockifyerHopList.native';
