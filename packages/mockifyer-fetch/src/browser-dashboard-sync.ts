/**
 * Browser-safe dashboard sync for web builds.
 * Handles scenario sync and network event reporting to the dashboard.
 */

import type {
  BrowserDashboardClient,
  NetworkEvent,
} from '@sgedda/mockifyer-core/dist/utils/dashboard-client.browser';

export interface BrowserDashboardSyncOptions {
  dashboardClient: BrowserDashboardClient;
  onScenarioChange?: (scenario: string) => void;
  pollIntervalMs?: number;
}

/**
 * Manages dashboard connection for browser builds.
 * Polls for scenario changes and reports network events.
 */
export class BrowserDashboardSync {
  private client: BrowserDashboardClient;
  private onScenarioChange?: (scenario: string) => void;
  private pollIntervalMs: number;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastScenario: string | null = null;
  private isPolling = false;

  constructor(options: BrowserDashboardSyncOptions) {
    this.client = options.dashboardClient;
    this.onScenarioChange = options.onScenarioChange;
    this.pollIntervalMs = options.pollIntervalMs ?? 2000; // Default 2s
  }

  /**
   * Start polling for scenario changes.
   */
  start(): void {
    if (this.isPolling) return;
    this.isPolling = true;

    // Poll immediately
    void this.poll();

    // Then poll on interval
    this.pollTimer = setInterval(() => {
      void this.poll();
    }, this.pollIntervalMs);
  }

  /**
   * Stop polling for scenario changes.
   */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isPolling = false;
  }

  /**
   * Poll dashboard for scenario changes.
   */
  private async poll(): Promise<void> {
    try {
      const clientId = this.client.clientId;
      let scenario: string | null = null;
      
      if (clientId) {
        scenario = await this.client.pollClientLaneScenario(clientId);
        // Fall back to global scenario if lanes are disabled
        if (!scenario) {
          scenario = await this.client.pollScenario();
        }
      } else {
        scenario = await this.client.pollScenario();
      }

      if (scenario && scenario !== this.lastScenario) {
        this.lastScenario = scenario;
        if (this.onScenarioChange) {
          this.onScenarioChange(scenario);
        }
      }
    } catch {
      // Ignore polling errors - dashboard may be offline
    }
  }

  /**
   * Post a network event to the dashboard.
   * Best-effort: never throws.
   */
  postNetworkEvent(event: NetworkEvent): void {
    void this.client.postNetworkEvent(event).catch(() => {
      // Ignore errors - observability must not break app
    });
  }

  /**
   * Get the dashboard base URL.
   */
  get dashboardBaseUrl(): string {
    return this.client.dashboardBaseUrl;
  }
}
