export type AiContextMode = 'profile' | 'schema' | 'suggest' | 'full';

export interface DashboardClientConfig {
  apiBase: string;
  auth?: { user: string; password: string };
}

export interface MockListFile {
  filename: string;
  endpoint: string | null;
  method?: string | null;
  modified: string;
  size: number;
}

export interface MockAiContextResponse {
  filename: string;
  scenario: string;
  endpoint: { method: string; url: string; pathname: string };
  status: number;
  mode: AiContextMode;
  profile: {
    fields: Record<string, unknown>;
    schema: Record<string, { type: string; enum?: unknown[]; nullable?: boolean }>;
    stateHints: Array<{ path: string; observed: unknown[] }>;
  };
  discovery: {
    sources: string[];
    includedPaths: number;
    omittedPaths: number;
    omittedBytes: number;
    mode: AiContextMode;
  };
  suggestions?: Array<{
    path: string;
    score: number;
    reasons: string[];
    sampleValue?: unknown;
  }>;
  data?: unknown;
}

export interface ScenarioConfigResponse {
  currentScenario: string;
  availableScenarios?: string[];
  scenarios?: string[];
}

export interface StatsResponse {
  scenario: string;
  totalFiles: number;
  endpoints: Array<{ endpoint: string; count: number }>;
  statusCodes: Record<string, number>;
  methods: Record<string, number>;
}

export interface MockFieldOverride {
  path: string;
  value: unknown;
}

export interface CopyArrayItemResponse {
  success: boolean;
  filename: string;
  scenario: string;
  arrayPath: string;
  newItemIndex: number;
  arrayLength: number;
}

export interface SetFieldOverridesResponse {
  success: boolean;
  filename: string;
  scenario: string;
  responseFieldOverrides: MockFieldOverride[];
}

export interface MockFieldOverrideEntry {
  path: string;
  value: unknown;
}

export interface SetFieldOverridesResponse {
  success: boolean;
  filename: string;
  scenario: string;
  responseFieldOverrides: MockFieldOverrideEntry[];
}

export interface CopyArrayItemResponse {
  success: boolean;
  filename: string;
  scenario: string;
  arrayPath: string;
  newItemIndex: number;
  arrayLength: number;
}

export type NetworkEventSource =
  | 'mock-hit'
  | 'mock-miss'
  | 'upstream'
  | 'blocked'
  | 'error';

export type NetworkEventTransport = 'axios' | 'fetch' | 'proxy';

export interface NetworkEvent {
  id: string;
  timestamp: string;
  scenario: string;
  clientId?: string | null;
  deviceId?: string | null;
  sessionId?: string | null;
  requestId?: string | null;
  parentRequestId?: string | null;
  sequence?: number;
  phase?: 'request_start' | 'request_end' | 'complete';
  transport: NetworkEventTransport;
  method: string;
  url: string;
  host?: string;
  path?: string;
  query?: string;
  status?: number;
  durationMs?: number;
  source: NetworkEventSource;
  requestHash?: string;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBodyPreview?: string;
  responseBodyPreview?: string;
  errorMessage?: string;
}

export interface NetworkLogConfig {
  enabled: boolean;
  captureBodies: boolean;
  updatedAt: string;
}

export interface NetworkEventsResponse {
  scenario: string;
  provider: string;
  ephemeral: boolean;
  networkLogConfig: NetworkLogConfig;
  events: NetworkEvent[];
}

export interface NetworkTraceHop {
  index: number;
  eventId: string;
  requestId: string | null;
  parentRequestId: string | null;
  timestamp: string;
  method: string;
  url: string;
  host?: string;
  path?: string;
  status?: number;
  source: NetworkEventSource;
  durationMs?: number;
  transport: NetworkEventTransport;
  clientId?: string | null;
  request?: { headers?: Record<string, string>; body?: string };
  response?: { status?: number; headers?: Record<string, string>; body?: string };
}

export interface NetworkTraceResponse {
  provider: string;
  networkLogConfig: NetworkLogConfig;
  trace: {
    lookup: { by: 'requestId' | 'eventId'; value: string };
    scenario: string;
    rootRequestId: string | null;
    anchorRequestId: string | null;
    anchorEventId: string;
    hopCount: number;
    hops: NetworkTraceHop[];
    incomplete: boolean;
  };
}

export interface NetworkLogConfigResponse {
  scenario: string;
  provider: string;
  enabled: boolean;
  captureBodies: boolean;
  updatedAt: string;
}

/** Resolve dashboard `/api` base from env (used by CLI and tests). */
export function resolveDashboardApiBaseFromEnv(): string {
  const url = (process.env.MOCKIFYER_DASHBOARD_URL ?? 'http://localhost:3002').replace(/\/$/, '');
  const mount = (process.env.MOCKIFYER_DASHBOARD_BASE ?? '').replace(/\/$/, '');
  return `${url}${mount}/api`;
}

export function resolveDashboardAuthFromEnv(): DashboardClientConfig['auth'] | undefined {
  const user = process.env.MOCKIFYER_DASHBOARD_AUTH_USER?.trim();
  const password = process.env.MOCKIFYER_DASHBOARD_AUTH_PASSWORD ?? '';
  if (!user) return undefined;
  return { user, password };
}

/** Encode mock filename for use in URL path segments (may contain slashes). */
export function encodeMockFilename(filename: string): string {
  return filename
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

export class DashboardApiClient {
  private readonly config: DashboardClientConfig;

  constructor(config?: Partial<DashboardClientConfig>) {
    this.config = {
      apiBase: config?.apiBase ?? resolveDashboardApiBaseFromEnv(),
      auth: config?.auth ?? resolveDashboardAuthFromEnv(),
    };
  }

  get apiBase(): string {
    return this.config.apiBase;
  }

  private authHeader(): string | undefined {
    if (!this.config.auth) return undefined;
    const token = Buffer.from(
      `${this.config.auth.user}:${this.config.auth.password}`,
      'utf8'
    ).toString('base64');
    return `Basic ${token}`;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    const auth = this.authHeader();
    if (auth) headers.set('Authorization', auth);
    if (init?.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${this.config.apiBase}${path}`, {
      ...init,
      headers,
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

  async getMockAiContext(params: {
    filename: string;
    scenario?: string;
    mode?: AiContextMode;
    includePaths?: string[];
    excludePaths?: string[];
    maxPaths?: number;
    includeRelated?: boolean;
  }): Promise<MockAiContextResponse> {
    const qs = new URLSearchParams();
    if (params.scenario) qs.set('scenario', params.scenario);
    if (params.mode) qs.set('mode', params.mode);
    if (params.includePaths?.length) qs.set('includePaths', params.includePaths.join(','));
    if (params.excludePaths?.length) qs.set('excludePaths', params.excludePaths.join(','));
    if (typeof params.maxPaths === 'number' && Number.isFinite(params.maxPaths)) {
      qs.set('maxPaths', String(params.maxPaths));
    }
    if (params.includeRelated === false) qs.set('includeRelated', '0');

    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const encoded = encodeMockFilename(params.filename);
    return this.request<MockAiContextResponse>(`/mocks/${encoded}/ai-context${suffix}`);
  }

  async listMocks(scenario?: string): Promise<{ files: MockListFile[]; scenario: string }> {
    const qs = scenario ? `?scenario=${encodeURIComponent(scenario)}` : '';
    return this.request(`/mocks${qs}`);
  }

  async searchMocks(params: {
    q: string;
    scenario?: string;
    limit?: number;
  }): Promise<{ files: MockListFile[]; scenario: string; query: string }> {
    const qs = new URLSearchParams();
    qs.set('q', params.q);
    if (params.scenario) qs.set('scenario', params.scenario);
    if (typeof params.limit === 'number') qs.set('limit', String(params.limit));
    return this.request(`/mocks/search?${qs.toString()}`);
  }

  async getMock(filename: string, scenario?: string): Promise<{ filename: string; data: unknown }> {
    const qs = scenario ? `?scenario=${encodeURIComponent(scenario)}` : '';
    const encoded = encodeMockFilename(filename);
    return this.request(`/mocks/${encoded}${qs}`);
  }

  async getScenarioConfig(): Promise<ScenarioConfigResponse> {
    return this.request('/scenario-config');
  }

  async getStats(scenario?: string): Promise<StatsResponse> {
    const qs = scenario ? `?scenario=${encodeURIComponent(scenario)}` : '';
    return this.request(`/stats${qs}`);
  }

  async setFieldOverrides(params: {
    filename: string;
    scenario?: string;
    responseFieldOverrides: MockFieldOverride[] | null;
    merge?: boolean;
  }): Promise<SetFieldOverridesResponse> {
    const qs = params.scenario ? `?scenario=${encodeURIComponent(params.scenario)}` : '';
    const encoded = encodeMockFilename(params.filename);
    return this.request(`/mocks/${encoded}/field-overrides${qs}`, {
      method: 'PATCH',
      body: JSON.stringify({
        responseFieldOverrides: params.responseFieldOverrides,
        merge: params.merge === true,
      }),
    });
  }

  async copyArrayItem(params: {
    filename: string;
    scenario?: string;
    arrayPath: string;
    fromIndex: number;
    itemOverrides?: Record<string, unknown>;
    insertAt?: 'append' | 'prepend' | number;
  }): Promise<CopyArrayItemResponse> {
    const qs = params.scenario ? `?scenario=${encodeURIComponent(params.scenario)}` : '';
    const encoded = encodeMockFilename(params.filename);
    return this.request(`/mocks/${encoded}/copy-array-item${qs}`, {
      method: 'POST',
      body: JSON.stringify({
        arrayPath: params.arrayPath,
        fromIndex: params.fromIndex,
        itemOverrides: params.itemOverrides,
        insertAt: params.insertAt,
      }),
    });
  }

  async listNetworkEvents(params?: {
    scenario?: string;
    clientId?: string;
    limit?: number;
    since?: string;
  }): Promise<NetworkEventsResponse> {
    const qs = new URLSearchParams();
    if (params?.scenario) qs.set('scenario', params.scenario);
    if (params?.clientId) qs.set('clientId', params.clientId);
    if (typeof params?.limit === 'number' && Number.isFinite(params.limit)) {
      qs.set('limit', String(params.limit));
    }
    if (params?.since) qs.set('since', params.since);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<NetworkEventsResponse>(`/network-events${suffix}`);
  }

  async getNetworkTrace(params: {
    requestId?: string;
    eventId?: string;
    scenario?: string;
    clientId?: string;
    limit?: number;
  }): Promise<NetworkTraceResponse> {
    const requestId = params.requestId?.trim() ?? '';
    const eventId = params.eventId?.trim() ?? '';
    if (!requestId && !eventId) {
      throw new Error('Provide requestId (X-Mockifyer-Request-Id) or eventId (network log row id)');
    }
    if (requestId && eventId) {
      throw new Error('Provide only one of requestId or eventId');
    }

    const qs = new URLSearchParams();
    if (params.scenario) qs.set('scenario', params.scenario);
    if (requestId) qs.set('requestId', requestId);
    if (eventId) qs.set('eventId', eventId);
    if (params.clientId) qs.set('clientId', params.clientId);
    if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
      qs.set('limit', String(params.limit));
    }
    return this.request<NetworkTraceResponse>(`/network-events/trace?${qs.toString()}`);
  }

  async getNetworkLogConfig(scenario?: string): Promise<NetworkLogConfigResponse> {
    const qs = scenario ? `?scenario=${encodeURIComponent(scenario)}` : '';
    return this.request<NetworkLogConfigResponse>(`/network-events/config${qs}`);
  }

  async listEntities(params?: {
    entityType?: string;
    tag?: string;
    q?: string;
  }): Promise<{ entities: unknown[]; updatedAt?: string }> {
    const qs = new URLSearchParams();
    if (params?.entityType) qs.set('entityType', params.entityType);
    if (params?.tag) qs.set('tag', params.tag);
    if (params?.q) qs.set('q', params.q);
    const suffix = qs.toString() ? `?${qs}` : '';
    return this.request(`/fixture-pool/entities${suffix}`);
  }

  async getEntity(id: string): Promise<{ entity: unknown; usedInScenarios?: string[] }> {
    return this.request(`/fixture-pool/entities/${encodeURIComponent(id)}`);
  }

  async createEntity(body: {
    id: string;
    entityType: string;
    label: string;
    data: unknown;
    tags?: string[];
  }): Promise<{ entity: unknown }> {
    return this.request(`/fixture-pool/entities`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async extractEntity(body: {
    scenario: string;
    filename: string;
    jsonPath: string;
    entityType: string;
    id?: string;
    extractAllArrayItems?: boolean;
    label?: string;
    tags?: string[];
  }): Promise<{ entities: unknown[] }> {
    return this.request(`/fixture-pool/entities/extract`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async forkEntity(id: string, body: { id: string; label?: string }): Promise<{ entity: unknown }> {
    return this.request(`/fixture-pool/entities/${encodeURIComponent(id)}/fork`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async updateEntity(
    id: string,
    body: { label?: string; entityType?: string; data?: unknown; tags?: string[] }
  ): Promise<{ entity: unknown }> {
    return this.request(`/fixture-pool/entities/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  async deleteEntity(id: string, force?: boolean): Promise<unknown> {
    const qs = force ? '?force=true' : '';
    return this.request(`/fixture-pool/entities/${encodeURIComponent(id)}${qs}`, {
      method: 'DELETE',
    });
  }

  async listResponseFixtures(): Promise<{ responses: unknown[] }> {
    return this.request(`/fixture-pool/responses`);
  }

  async promoteResponse(body: {
    scenario: string;
    filename: string;
    id?: string;
    label?: string;
    tags?: string[];
  }): Promise<{ response: unknown }> {
    return this.request(`/fixture-pool/responses/promote`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async getResponseFixture(id: string): Promise<{ response: unknown }> {
    return this.request(`/fixture-pool/responses/${encodeURIComponent(id)}`);
  }
}
