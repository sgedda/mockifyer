export type DashboardHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface DashboardApiEndpoint {
  method: DashboardHttpMethod
  /** Path after the API base, starting with `/`. */
  path: string
  summary: string
  /**
   * JSON body for a POST example. `null` means the POST has no body.
   * Omitted on non-POST routes.
   */
  exampleBody?: unknown
  /** Query string without `?`, appended to the example URL. */
  exampleQuery?: string
}

export interface DashboardApiGroup {
  id: string
  title: string
  endpoints: DashboardApiEndpoint[]
}

/** Dashboard HTTP API shown on the API page. POST entries include example bodies. */
export const DASHBOARD_API_CATALOG: DashboardApiGroup[] = [
  {
    id: 'health',
    title: 'Health',
    endpoints: [
      { method: 'GET', path: '/health', summary: 'Dashboard process health.' },
    ],
  },
  {
    id: 'mocks',
    title: 'Mocks',
    endpoints: [
      {
        method: 'GET',
        path: '/mocks',
        summary: 'List mocks for a scenario. Query: scenario, optional similarGroups=1.',
      },
      {
        method: 'GET',
        path: '/mocks/search',
        summary: 'Search mock filenames and request URLs. Query: scenario, q.',
      },
      {
        method: 'GET',
        path: '/mocks/domain-path-rules',
        summary: 'Read host and path record-response / allow-upstream rules. Query: scenario.',
      },
      {
        method: 'POST',
        path: '/mocks/domain-path-rules',
        summary:
          'Set or clear a domain-path rule. Send rule: null to remove the path. recordResponses is required when rule is an object.',
        exampleBody: {
          scenario: 'default',
          domainPath: 'api.example.com/v1',
          rule: { recordResponses: true, autoMock: true, allowUpstream: false },
        },
      },
      {
        method: 'GET',
        path: '/mocks/:filename',
        summary: 'Read one mock. Query: scenario.',
      },
      {
        method: 'PUT',
        path: '/mocks/:filename',
        summary: 'Update response data, date overrides, or replay mode. Query: scenario.',
      },
      {
        method: 'DELETE',
        path: '/mocks/:filename',
        summary: 'Delete one mock. Query: scenario.',
      },
      {
        method: 'POST',
        path: '/mocks/:filename/duplicate',
        summary: 'Copy a mock in the same scenario. Query: scenario. No JSON body.',
        exampleQuery: 'scenario=default',
        exampleBody: null,
      },
      {
        method: 'POST',
        path: '/mocks/:filename/refresh-from-live',
        summary: 'Re-fetch the live API and overwrite the stored response. clientId is optional.',
        exampleQuery: 'scenario=default',
        exampleBody: { clientId: 'lane-1' },
      },
      {
        method: 'POST',
        path: '/mocks/:filename/copy-array-item',
        summary: 'Duplicate one item inside a response array and persist it. Query: scenario.',
        exampleQuery: 'scenario=default',
        exampleBody: {
          arrayPath: 'items',
          fromIndex: 0,
          insertAt: 'append',
          itemOverrides: { id: 'copy-1' },
        },
      },
      {
        method: 'POST',
        path: '/mocks/bulk-live-api',
        summary: 'Turn live-API passthrough on or off for every mock under a host or path prefix.',
        exampleBody: {
          scenario: 'default',
          domainPath: 'api.example.com',
          useLiveApi: true,
        },
      },
      {
        method: 'POST',
        path: '/mocks/bulk-replay-mode',
        summary: 'Mark specific mock filenames as stored replay or passthrough.',
        exampleBody: {
          scenario: 'default',
          stored: ['GET_api.example.com_v1_items.json'],
          passthrough: ['POST_api.example.com_v1_orders.json'],
        },
      },
    ],
  },
  {
    id: 'proxy',
    title: 'Proxy',
    endpoints: [
      {
        method: 'POST',
        path: '/proxy',
        summary:
          'Record or replay one HTTP call through the dashboard. Requires the redis or sqlite provider. url is required.',
        exampleBody: {
          url: 'https://api.example.com/v1/items',
          method: 'GET',
          headers: { Accept: 'application/json' },
          scenario: 'default',
          clientId: 'lane-1',
          record: false,
        },
      },
      {
        method: 'GET',
        path: '/proxy-config',
        summary: 'Read record-on-miss and allow-upstream for a scenario. Query: scenario.',
      },
      {
        method: 'POST',
        path: '/proxy-config',
        summary: 'Update proxy policy for a scenario. Requires the redis provider.',
        exampleBody: {
          scenario: 'default',
          recordOnMiss: true,
          allowUpstream: true,
        },
      },
    ],
  },
  {
    id: 'scenarios',
    title: 'Scenarios',
    endpoints: [
      {
        method: 'GET',
        path: '/scenario-config',
        summary: 'Active scenario, available names, and lock flags.',
      },
      {
        method: 'POST',
        path: '/scenario-config/set',
        summary: 'Switch the active scenario.',
        exampleBody: { scenario: 'default' },
      },
      {
        method: 'POST',
        path: '/scenario-config/create',
        summary: 'Create a scenario. deriveFrom copies mocks from another scenario when set.',
        exampleBody: { scenario: 'checkout', deriveFrom: 'default' },
      },
      {
        method: 'POST',
        path: '/scenario-config/lock',
        summary: 'Lock or unlock a scenario. Locked scenarios reject mock and date writes.',
        exampleBody: { scenario: 'default', locked: true },
      },
      {
        method: 'GET',
        path: '/scenario-config/export',
        summary: 'Download a scenario bundle (mocks, date, proxy). Query: scenario.',
      },
      {
        method: 'POST',
        path: '/scenario-config/import',
        summary:
          'Import a formatVersion 1 bundle. You can also wrap the export as { bundle, targetScenario }.',
        exampleBody: {
          formatVersion: 1,
          sourceScenario: 'default',
          targetScenario: 'imported',
          replaceExistingMocks: false,
          applyDateConfig: true,
          applyProxyConfig: true,
          mocks: [],
        },
      },
      {
        method: 'POST',
        path: '/scenario-config/clear-mocks',
        summary: 'Delete mocks for a scenario and keep the scenario name.',
        exampleBody: { scenario: 'checkout' },
      },
      {
        method: 'POST',
        path: '/scenario-config/rename',
        summary: 'Rename a scenario and move its mocks.',
        exampleBody: { scenario: 'checkout', newName: 'checkout-v2' },
      },
      {
        method: 'POST',
        path: '/scenario-config/delete',
        summary: 'Delete a scenario and its mocks. default cannot be deleted.',
        exampleBody: { scenario: 'checkout' },
      },
    ],
  },
  {
    id: 'dates',
    title: 'Date config',
    endpoints: [
      {
        method: 'GET',
        path: '/date-config',
        summary: 'Read the scenario date override. Query: scenario.',
      },
      {
        method: 'POST',
        path: '/date-config',
        summary: 'Set a fixed date or millisecond offset. Send fixedDate: null to clear it.',
        exampleBody: {
          scenario: 'default',
          fixedDate: '2024-12-25T00:00:00.000Z',
        },
      },
    ],
  },
  {
    id: 'lanes',
    title: 'Client lanes',
    endpoints: [
      { method: 'GET', path: '/client-lanes', summary: 'List client lanes and the scenario each one last used.' },
      {
        method: 'PUT',
        path: '/client-lanes/:clientId/scenario',
        summary: 'Assign a scenario to a client lane. Body: { scenario } or null to clear.',
      },
      {
        method: 'PUT',
        path: '/client-lanes/:clientId/date',
        summary: 'Set a lane fixed date. Body: { fixedDate }.',
      },
      {
        method: 'DELETE',
        path: '/client-lanes/:clientId',
        summary: 'Remove a client lane.',
      },
    ],
  },
  {
    id: 'network',
    title: 'Network log',
    endpoints: [
      {
        method: 'GET',
        path: '/network-events',
        summary: 'List recorded hops. Query: scenario, optional clientId.',
      },
      {
        method: 'GET',
        path: '/network-events/trace',
        summary: 'Resolve a call chain. Query: requestId or eventId, plus scenario.',
      },
      {
        method: 'GET',
        path: '/network-events/explain',
        summary: 'Incident context for a crash. Query: incidentId or sessionId, plus scenario.',
      },
      {
        method: 'POST',
        path: '/network-events',
        summary: 'Append one hop. method, url, source, and transport are required.',
        exampleBody: {
          scenario: 'default',
          event: {
            method: 'GET',
            url: 'https://api.example.com/v1/items',
            source: 'mock-hit',
            transport: 'axios',
            status: 200,
          },
        },
      },
      {
        method: 'DELETE',
        path: '/network-events',
        summary: 'Clear the network log. Query: scenario.',
      },
    ],
  },
  {
    id: 'favorites',
    title: 'Favorites',
    endpoints: [
      { method: 'GET', path: '/favorites', summary: 'List favorited requests.' },
      {
        method: 'POST',
        path: '/favorites',
        summary: 'Favorite a mock by filename. The mock must already exist.',
        exampleBody: {
          scenario: 'default',
          filename: 'GET_api.example.com_v1_items.json',
        },
      },
      {
        method: 'DELETE',
        path: '/favorites/:id',
        summary: 'Remove a favorite by id.',
      },
    ],
  },
  {
    id: 'overrides',
    title: 'Override groups',
    endpoints: [
      {
        method: 'GET',
        path: '/override-groups',
        summary: 'List override groups. Query: scenario.',
      },
      {
        method: 'PUT',
        path: '/override-groups/:id',
        summary: 'Create or replace one override group.',
      },
      {
        method: 'PATCH',
        path: '/override-groups/:id/entries',
        summary: 'Update one filename entry inside a group.',
      },
      {
        method: 'DELETE',
        path: '/override-groups/:id',
        summary: 'Delete an override group.',
      },
      {
        method: 'POST',
        path: '/override-sets/ensure-default',
        summary: 'Create the default override set when it is missing.',
        exampleBody: { scenario: 'default' },
      },
    ],
  },
]

/**
 * curl for a POST route against the dashboard the page is open on.
 * Returns null for other methods.
 */
export function buildPostExampleCurl(
  origin: string,
  apiBase: string,
  endpoint: DashboardApiEndpoint
): string | null {
  if (endpoint.method !== 'POST') return null
  const base = apiBase.replace(/\/$/, '')
  const query = endpoint.exampleQuery ? `?${endpoint.exampleQuery}` : ''
  const url = `${origin}${base}${endpoint.path}${query}`
  if (endpoint.exampleBody == null) {
    return `curl -s -X POST '${url}'`
  }
  const json = JSON.stringify(endpoint.exampleBody, null, 2)
  return [`curl -s -X POST '${url}' \\`, `  -H 'Content-Type: application/json' \\`, `  -d '${json}'`].join('\n')
}
