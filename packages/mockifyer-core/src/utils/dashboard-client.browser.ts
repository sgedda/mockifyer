/**
 * Browser-safe dashboard client for web builds.
 * Uses fetch only (no Node.js built-ins).
 */

export interface DashboardClientConfig {
  dashboardBaseUrl: string;
  auth?: { user: string; password: string };
  clientId?: string;
}

export interface ScenarioConfigResponse {
  currentScenario: string;
  availableScenarios?: string[];
  scenarios?: string[];
}

export interface SetScenarioResponse {
  success: boolean;
  message: string;
  currentScenario: string;
  scenarios: string[];
}

export interface ClientLane {
  clientId: string;
  scenario: string;
  note: string | null;
}

export interface ClientLanesResponse {
  enabled: boolean;
  reason?: string | null;
  lanes: ClientLane[];
  discoveredLanes?: string[];
  globalScenario: string | null;
}

export interface NetworkEvent {
  id?: string;
  timestamp?: string;
  scenario?: string;
  clientId?: string | null;
  deviceId?: string | null;
  sessionId?: string | null;
  requestId?: string | null;
  parentRequestId?: string | null;
  sequence?: number;
  phase?: 'request_start' | 'request_end' | 'complete';
  transport: 'fetch' | 'axios' | 'proxy';
  method: string;
  url: string;
  host?: string;
  path?: string;
  query?: string;
  status?: number;
  durationMs?: number;
  source: 'mock-hit' | 'mock-miss' | 'upstream' | 'blocked' | 'error';
  requestHash?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBodyPreview?: string;
  responseBodyPreview?: string;
  errorMessage?: string;
}

/**
 * Browser-safe dashboard client.
 * Uses fetch for HTTP requests (no Node.js dependencies).
 */
export class BrowserDashboardClient {
  private readonly config: DashboardClientConfig;

  constructor(config: DashboardClientConfig) {
    this.config = {
      dashboardBaseUrl: config.dashboardBaseUrl.replace(/\/+$/, ''),
      auth: config.auth,
      clientId: config.clientId,
    };
  }

  get dashboardBaseUrl(): string {
    return this.config.dashboardBaseUrl;
  }

  get clientId(): string | undefined {
    return this.config.clientId;
  }

  private authHeader(): string | undefined {
    if (!this.config.auth) return undefined;
    const token = btoa(`${this.config.auth.user}:${this.config.auth.password}`);
    return `Basic ${token}`;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    const auth = this.authHeader();
    if (auth) headers.set('Authorization', auth);
    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const url = `${this.config.dashboardBaseUrl}/api${path}`;
    const response = await fetch(url, {
      ...init,
      headers,
      credentials: 'omit', // Disable cookies for dashboard API
    });

    const text = await response.text();
    let payload: unknown = text;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      const err =
        payload && typeof payload === 'object' && payload !== null
          ? (payload as { error?: string; details?: string })
          : {};
      throw new Error(
        err.error || err.details || `Dashboard API ${response.status}: ${text.slice(0, 200)}`
      );
    }

    return payload as T;
  }

  /**
   * Get the current scenario configuration.
   */
  async getScenarioConfig(): Promise<ScenarioConfigResponse> {
    return this.request('/scenario-config');
  }

  /**
   * Set the active scenario (global or for this client's lane).
   */
  async setScenario(scenario: string): Promise<SetScenarioResponse> {
    return this.request('/scenario-config/set', {
      method: 'POST',
      body: JSON.stringify({ scenario }),
    });
  }

  /**
   * Get client lane configuration (requires Redis/sqlite dashboard).
   */
  async getClientLanes(): Promise<ClientLanesResponse> {
    return this.request('/client-lanes');
  }

  /**
   * Set scenario for a specific client lane.
   */
  async setClientLaneScenario(clientId: string, scenario: string | null): Promise<void> {
    await this.request(`/client-lanes/${encodeURIComponent(clientId)}/scenario`, {
      method: 'PUT',
      body: JSON.stringify({ scenario }),
    });
  }

  /**
   * Post a network event to the dashboard.
   * Best-effort: never throws, safe to call from interceptors.
   */
  async postNetworkEvent(event: NetworkEvent): Promise<void> {
    try {
      await this.request('/network-events', {
        method: 'POST',
        body: JSON.stringify({ event }),
      });
    } catch (error) {
      // Observability must not break app requests
      console.warn('[Mockifyer] Failed to post network event to dashboard:', error);
    }
  }

  /**
   * Check if the dashboard is reachable.
   */
  async health(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.dashboardBaseUrl}/api/health`, {
        credentials: 'omit',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Poll for scenario changes.
   * Returns the current scenario or null if dashboard is unreachable.
   */
  async pollScenario(): Promise<string | null> {
    try {
      const config = await this.getScenarioConfig();
      return config.currentScenario;
    } catch {
      return null;
    }
  }

  /**
   * Poll for client lane scenario changes.
   */
  async pollClientLaneScenario(clientId: string): Promise<string | null> {
    try {
      const lanes = await this.getClientLanes();
      if (!lanes.enabled) {
        // Lanes disabled (filesystem dashboard): fall back to global scenario
        return this.pollScenario();
      }
      
      const lane = lanes.lanes.find(l => l.clientId === clientId);
      return lane?.scenario ?? lanes.globalScenario ?? null;
    } catch {
      return null;
    }
  }
}
