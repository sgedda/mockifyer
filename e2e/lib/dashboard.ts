import { DASHBOARD, ATHENS_ENDPOINT, ATHENS_ENDPOINT_PREFIX, GATEWAY, BASE_SCENARIO, LANE } from './env';

type Json = any;

export class Dashboard {
  constructor(readonly base: string = DASHBOARD) {}

  async call(method: string, path: string, body?: Json): Promise<{ status: number; json: Json }> {
    const res = await fetch(this.base + '/api' + path, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: Json = text;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json };
  }
  private async ok(method: string, path: string, body?: Json): Promise<Json> {
    const r = await this.call(method, path, body);
    if (r.status >= 400) throw new Error(`${method} ${path} -> ${r.status}: ${JSON.stringify(r.json)}`);
    return r.json;
  }
  private q(s?: string) { return s ? `?scenario=${encodeURIComponent(s)}` : ''; }

  // scenarios
  scenarioConfig() { return this.ok('GET', '/scenario-config'); }
  setGlobalScenario(scenario: string) { return this.ok('POST', '/scenario-config/set', { scenario }); }
  createScenario(scenario: string, deriveFrom?: string) { return this.ok('POST', '/scenario-config/create', { scenario, deriveFrom }); }
  deleteScenario(scenario: string) { return this.call('POST', '/scenario-config/delete', { scenario }); }

  // client lanes
  lanes(): Promise<{ enabled: boolean; lanes: Json[]; laneGlobalFallback?: boolean }> { return this.ok('GET', '/client-lanes'); }
  async lane(clientId: string) { return (await this.lanes()).lanes.find((l: Json) => l.clientId === clientId); }
  setLaneScenario(clientId: string, scenario: string) { return this.ok('PUT', `/client-lanes/${clientId}/scenario`, { scenario }); }
  deleteLane(clientId: string) { return this.ok('DELETE', `/client-lanes/${clientId}`); }
  setLaneDate(clientId: string, fixedDate: string | null) { return this.ok('PUT', `/client-lanes/${clientId}/date`, { fixedDate }); }
  /** #484: strict lane mode, clients with a clientId but no lane follow the global scenario. */
  setLaneGlobalFallback(enabled: boolean) { return this.ok('PUT', '/client-lanes/settings/global-fallback', { enabled }); }
  /** Demo defaults: lane and global on the base scenario, lane global fallback off. */
  async restoreDemoScenarios() {
    await this.setLaneGlobalFallback(false);
    await this.setLaneScenario(LANE, BASE_SCENARIO);
    await this.setGlobalScenario(BASE_SCENARIO);
  }

  // mocks
  async listMocks(scenario?: string): Promise<Json[]> { return (await this.ok('GET', '/mocks' + this.q(scenario))).files; }
  getMock(file: string, scenario?: string) { return this.ok('GET', `/mocks/${file}${this.q(scenario)}`); }
  putMock(file: string, body: Json, scenario?: string) { return this.call('PUT', `/mocks/${file}${this.q(scenario)}`, body); }
  deleteMock(file: string, scenario?: string) { return this.call('DELETE', `/mocks/${file}${this.q(scenario)}`); }
  getFieldOverrides(file: string, scenario?: string) { return this.ok('GET', `/mocks/${file}/field-overrides${this.q(scenario)}`); }
  clearFieldOverrides(file: string, scenario?: string) {
    return this.call('PATCH', `/mocks/${file}/field-overrides${this.q(scenario)}`, { responseFieldOverrides: null });
  }
  async findMock(scenario: string, predicate: (endpoint: string) => boolean): Promise<string> {
    const f = (await this.listMocks(scenario)).find((m) => predicate(m.endpoint));
    if (!f) throw new Error(`no matching mock in ${scenario}`);
    return f.filename;
  }
  /** List entry for one mock (holds replayMode, override counts, ...). */
  async mockMeta(file: string, scenario: string): Promise<Json> {
    const f = (await this.listMocks(scenario)).find((m) => m.filename === file);
    if (!f) throw new Error(`mock ${file} not in ${scenario}`);
    return f;
  }
  athensMock(scenario: string) { return this.findMock(scenario, (e) => e === ATHENS_ENDPOINT); }

  // dates
  dateConfig(scenario?: string) { return this.ok('GET', '/date-config' + this.q(scenario)); }
  setDateConfig(body: Json) { return this.ok('POST', '/date-config', body); }

  // network log / traces
  setNetworkBodies(scenario: string, captureBodies: boolean) {
    return this.ok('PUT', '/network-events/config', { scenario, captureBodies });
  }
  async networkEvents(scenario: string, limit = 50): Promise<Json[]> {
    return (await this.ok('GET', `/network-events?scenario=${encodeURIComponent(scenario)}&limit=${limit}`)).events;
  }
}

/** Atlantis Discover through the gateway, the same call the app makes. */
export async function gatewayAtlantis(): Promise<{ status: number; json: Json }> {
  const res = await fetch(`${GATEWAY}/api/discover?destinationKey=atlantis`, {
    signal: AbortSignal.timeout(15000),
    headers: { 'X-Mockifyer-Client-Id': 'wanderweird-demo' },
  });
  const text = await res.text();
  let json: Json = text; try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json };
}
export async function gatewayTemp(): Promise<number | undefined> {
  return (await gatewayAtlantis()).json?.weather?.current?.temperature_2m;
}

export const dashboard = new Dashboard();
