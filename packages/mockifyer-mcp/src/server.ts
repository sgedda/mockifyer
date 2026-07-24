import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { DashboardApiClient } from './dashboard-client.js';

function jsonResult(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function toolError(message: string) {
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: message }],
  };
}

const aiContextModeSchema = z.enum(['profile', 'schema', 'suggest', 'full']);

/**
 * Register Mockifyer MCP tools backed by the running dashboard HTTP API.
 */
export function createMockifyerMcpServer(client = new DashboardApiClient()): McpServer {
  const server = new McpServer({
    name: 'mockifyer',
    version: '0.1.0',
  });

  server.registerTool(
    'mockifyer_get_mock_ai_context',
    {
      description:
        'Return a lightweight AI-friendly projection of a mock recording (selected fields, schema summary, state hints). Prefer this over mockifyer_get_mock to avoid huge response payloads.',
      inputSchema: {
        filename: z
          .string()
          .describe('Mock filename from mockifyer_list_mocks or mockifyer_search_mocks'),
        scenario: z.string().optional().describe('Scenario name (defaults to dashboard active scenario)'),
        mode: aiContextModeSchema
          .optional()
          .describe('profile (default): fields+schema; schema: types only; suggest: ranked paths; full: entire mock'),
        includePaths: z
          .array(z.string())
          .optional()
          .describe('Dot paths to force include (e.g. orders.*.status)'),
        excludePaths: z.array(z.string()).optional().describe('Dot paths to exclude'),
        maxPaths: z.number().int().min(1).max(100).optional().describe('Max selected body paths (default 25)'),
        includeRelated: z
          .boolean()
          .optional()
          .describe('Include sibling mocks on same endpoint for cross-recording state hints (default true)'),
      },
    },
    async (args) => {
      try {
        const result = await client.getMockAiContext({
          filename: args.filename,
          scenario: args.scenario,
          mode: args.mode,
          includePaths: args.includePaths,
          excludePaths: args.excludePaths,
          maxPaths: args.maxPaths,
          includeRelated: args.includeRelated,
        });
        return jsonResult(result);
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_list_mocks',
    {
      description: 'List mock recordings in a scenario (filename, endpoint, method, modified).',
      inputSchema: {
        scenario: z.string().optional().describe('Scenario name (defaults to active scenario)'),
      },
    },
    async (args) => {
      try {
        const result = await client.listMocks(args.scenario);
        return jsonResult({
          scenario: result.scenario,
          count: result.files.length,
          files: result.files.map((f) => ({
            filename: f.filename,
            endpoint: f.endpoint,
            method: f.method,
            modified: f.modified,
            size: f.size,
          })),
        });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_search_mocks',
    {
      description: 'Search mocks by filename, endpoint URL, or method substring.',
      inputSchema: {
        q: z.string().describe('Search query'),
        scenario: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional().describe('Max results (default 200)'),
      },
    },
    async (args) => {
      try {
        const result = await client.searchMocks(args);
        return jsonResult(result);
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_get_mock',
    {
      description:
        'Fetch the full mock recording (request + response). Use mockifyer_get_mock_ai_context when you only need semantic/state fields.',
      inputSchema: {
        filename: z.string(),
        scenario: z.string().optional(),
      },
    },
    async (args) => {
      try {
        const result = await client.getMock(args.filename, args.scenario);
        return jsonResult(result);
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_list_scenarios',
    {
      description: 'List available scenarios and the currently active scenario.',
      inputSchema: {},
    },
    async () => {
      try {
        const config = await client.getScenarioConfig();
        const available =
          config.availableScenarios ??
          config.scenarios ??
          (config.currentScenario ? [config.currentScenario] : []);
        return jsonResult({
          currentScenario: config.currentScenario,
          availableScenarios: available,
        });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_set_scenario',
    {
      description:
        'Switch the dashboard active/global scenario. For Redis/sqlite multi-client isolation prefer mockifyer_set_client_lane_scenario so Playwright/app lanes stay independent.',
      inputSchema: {
        scenario: z
          .string()
          .describe('Scenario name (letters, numbers, hyphens, underscores)'),
      },
    },
    async (args) => {
      try {
        return jsonResult(await client.setScenario(args.scenario));
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_create_scenario',
    {
      description:
        'Create a scenario and make it active. Pass deriveFrom to copy mocks (and date config) from an existing scenario — e.g. check-in-open derived from default before applying $pool refs/overrides.',
      inputSchema: {
        scenario: z.string().describe('New scenario name'),
        deriveFrom: z
          .string()
          .nullable()
          .optional()
          .describe('Existing scenario to copy from; omit/null for empty'),
      },
    },
    async (args) => {
      try {
        return jsonResult(await client.createScenario(args.scenario, args.deriveFrom ?? null));
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_set_client_lane_scenario',
    {
      description:
        'Map a Redis/sqlite client lane (MOCKIFYER_CLIENT_ID) to a scenario for isolated E2E/demo runs. Requires dashboard --provider redis|sqlite. Pass scenario=null to clear the lane mapping.',
      inputSchema: {
        clientId: z.string().describe('Client lane id (e.g. trips-e2e-checkin)'),
        scenario: z
          .string()
          .nullable()
          .describe('Scenario to bind, or null to clear the lane override'),
      },
    },
    async (args) => {
      try {
        return jsonResult(await client.setClientLaneScenario(args.clientId, args.scenario));
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_list_client_lanes',
    {
      description:
        'List Redis/sqlite client lanes and their configured scenarios (disabled on filesystem provider). Use before mockifyer_set_client_lane_scenario.',
      inputSchema: {},
    },
    async () => {
      try {
        return jsonResult(await client.listClientLanes());
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_get_endpoint_stats',
    {
      description: 'Summarize mock counts per endpoint, HTTP method, and status code for a scenario.',
      inputSchema: {
        scenario: z.string().optional(),
      },
    },
    async (args) => {
      try {
        const stats = await client.getStats(args.scenario);
        return jsonResult({
          scenario: stats.scenario,
          totalFiles: stats.totalFiles,
          topEndpoints: stats.endpoints,
          statusCodes: stats.statusCodes,
          methods: stats.methods,
        });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_set_field_overrides',
    {
      description:
        'Set replay-time field overrides on a mock (overlay on stored response.data). Small payload — only path/value pairs, not the full response.',
      inputSchema: {
        filename: z.string().describe('Mock filename'),
        scenario: z.string().optional(),
        overrides: z
          .array(
            z.object({
              path: z.string().describe('Dot path from response.data root, e.g. bookings.0.status'),
              value: z.any().describe('Value to serve at replay time'),
            })
          )
          .describe('Field overrides to apply when the mock is served'),
        merge: z
          .boolean()
          .optional()
          .describe('When true, append to existing overrides instead of replacing'),
        clear: z.boolean().optional().describe('When true, remove all field overrides'),
      },
    },
    async (args) => {
      try {
        const responseFieldOverrides = args.clear
          ? null
          : (args.overrides ?? []).map((entry) => ({
              path: entry.path,
              value: entry.value,
            }));
        const result = await client.setFieldOverrides({
          filename: args.filename,
          scenario: args.scenario,
          responseFieldOverrides,
          merge: args.merge,
        });
        return jsonResult(result);
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_copy_array_item',
    {
      description:
        'Clone an array item in response.data, apply optional field overrides on the clone, and persist. Use to add a booking copied from an existing one without sending the full response to the AI.',
      inputSchema: {
        filename: z.string().describe('Mock filename'),
        scenario: z.string().optional(),
        arrayPath: z
          .string()
          .describe('Path to the array from response.data root, e.g. data.bookings or bookings'),
        fromIndex: z.number().int().min(0).describe('Index of the item to clone'),
        itemOverrides: z
          .record(z.unknown())
          .optional()
          .describe('Fields to change on the clone only, e.g. { status: "CONFIRMED" }'),
        insertAt: z
          .union([z.enum(['append', 'prepend']), z.number().int().min(0)])
          .optional()
          .describe('Where to insert the clone (default append)'),
      },
    },
    async (args) => {
      try {
        const result = await client.copyArrayItem({
          filename: args.filename,
          scenario: args.scenario,
          arrayPath: args.arrayPath,
          fromIndex: args.fromIndex,
          itemOverrides: args.itemOverrides,
          insertAt: args.insertAt,
        });
        return jsonResult(result);
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_list_network_events',
    {
      description:
        'List recent network log hops (mock hits, upstream calls, proxy traffic). Use to find requestId/eventId before calling mockifyer_get_network_trace.',
      inputSchema: {
        scenario: z.string().optional().describe('Scenario name (defaults to active scenario)'),
        clientId: z.string().optional().describe('Filter by client lane id'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(5000)
          .optional()
          .describe('Max events to return (default 200)'),
        since: z.string().optional().describe('ISO timestamp — only events after this time'),
      },
    },
    async (args) => {
      try {
        const result = await client.listNetworkEvents({
          scenario: args.scenario,
          clientId: args.clientId,
          limit: args.limit,
          since: args.since,
        });
        return jsonResult({
          scenario: result.scenario,
          provider: result.provider,
          ephemeral: result.ephemeral,
          networkLogConfig: result.networkLogConfig,
          count: result.events.length,
          events: result.events.map((event) => ({
            id: event.id,
            timestamp: event.timestamp,
            method: event.method,
            url: event.url,
            status: event.status,
            source: event.source,
            transport: event.transport,
            requestId: event.requestId,
            parentRequestId: event.parentRequestId,
            durationMs: event.durationMs,
            clientId: event.clientId,
            requestBodyPreview: event.requestBodyPreview,
            responseBodyPreview: event.responseBodyPreview,
            errorMessage: event.errorMessage,
          })),
        });
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_get_network_trace',
    {
      description:
        'Resolve a multi-service call chain from the network log (gateway → downstream → external). Each hop may include request/response body previews when captureBodies is enabled.',
      inputSchema: {
        requestId: z
          .string()
          .optional()
          .describe('X-Mockifyer-Request-Id from entry service (preferred lookup key)'),
        eventId: z.string().optional().describe('Dashboard network log row id'),
        scenario: z.string().optional().describe('Scenario name (defaults to active scenario)'),
        clientId: z.string().optional().describe('Client lane filter when scanning events'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(5000)
          .optional()
          .describe('Max network events to scan when resolving the trace (default 5000)'),
      },
    },
    async (args) => {
      try {
        const result = await client.getNetworkTrace({
          requestId: args.requestId,
          eventId: args.eventId,
          scenario: args.scenario,
          clientId: args.clientId,
          limit: args.limit,
        });
        return jsonResult(result);
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_get_network_log_config',
    {
      description:
        'Return network logging settings for a scenario (enabled, captureBodies). Traces include body previews only when captureBodies is true.',
      inputSchema: {
        scenario: z.string().optional().describe('Scenario name (defaults to active scenario)'),
      },
    },
    async (args) => {
      try {
        const result = await client.getNetworkLogConfig(args.scenario);
        return jsonResult(result);
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_list_entities',
    {
      description:
        'List fixture-pool entities (shared catalog of domain objects). Extract from recordings with mockifyer_extract_entity. Entities are inert until a future activation path; matching still uses normal scenario mock files. Endpoint slots are deferred.',
      inputSchema: {
        entityType: z.string().optional(),
        tag: z.string().optional(),
        q: z.string().optional().describe('Search id/label/entityType'),
      },
    },
    async (args) => {
      try {
        return jsonResult(await client.listEntities(args));
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_get_entity',
    {
      description: 'Get one pool entity by id (includes usedInScenarios from scenario manifests).',
      inputSchema: { id: z.string() },
    },
    async (args) => {
      try {
        return jsonResult(await client.getEntity(args.id));
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_extract_entity',
    {
      description:
        'Extract entity data from a mock recording into the pool (jsonPath e.g. trips.0). Use extractAllArrayItems to create one entity per array element. Catalog only for now — does not change request matching.',
      inputSchema: {
        scenario: z.string(),
        filename: z.string(),
        jsonPath: z.string().describe('Dot path under response.data, e.g. trips.0'),
        entityType: z.string().describe('e.g. trip, user, booking'),
        id: z.string().optional(),
        extractAllArrayItems: z.boolean().optional(),
        label: z.string().optional(),
        tags: z.array(z.string()).optional(),
      },
    },
    async (args) => {
      try {
        return jsonResult(await client.extractEntity(args));
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_fork_entity',
    {
      description: 'Copy a pool entity to a new id (safe when you need scenario-specific edits without mutating the shared base).',
      inputSchema: {
        id: z.string().describe('Source entity id'),
        newId: z.string().describe('New entity id'),
        label: z.string().optional(),
      },
    },
    async (args) => {
      try {
        return jsonResult(await client.forkEntity(args.id, { id: args.newId, label: args.label }));
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_create_entity',
    {
      description: 'Create a manual pool entity.',
      inputSchema: {
        id: z.string(),
        entityType: z.string(),
        label: z.string(),
        data: z.unknown(),
        tags: z.array(z.string()).optional(),
      },
    },
    async (args) => {
      try {
        return jsonResult(await client.createEntity(args));
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_delete_entity',
    {
      description:
        'Delete a pool entity. Fails with 409 if scenario manifests still reference it unless force=true.',
      inputSchema: {
        id: z.string(),
        force: z.boolean().optional().describe('Delete even when referenced by scenario manifests'),
      },
    },
    async (args) => {
      try {
        return jsonResult(await client.deleteEntity(args.id, args.force));
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_promote_response',
    {
      description: 'Promote a full mock recording into a response fixture (whole HTTP payload escape hatch).',
      inputSchema: {
        scenario: z.string(),
        filename: z.string(),
        id: z.string().optional(),
        label: z.string().optional(),
        tags: z.array(z.string()).optional(),
      },
    },
    async (args) => {
      try {
        return jsonResult(await client.promoteResponse(args));
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_list_response_fixtures',
    {
      description:
        'List full-response fixtures in the pool. Use with mockifyer_preview_pool_ref / mockifyer_set_pool_ref to activate via $pool refs.',
      inputSchema: {},
    },
    async () => {
      try {
        return jsonResult(await client.listResponseFixtures());
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_preview_pool_ref',
    {
      description:
        'Preview resolving a promoted pool response with optional path + field/index select (document keeps envelope; value returns subtree).',
      inputSchema: {
        id: z.string().describe('Pool response fixture id'),
        mode: z.enum(['document', 'value']).optional(),
        path: z.string().optional().describe('Dot path into the pool response body'),
        select: z
          .object({
            field: z.string(),
            values: z.array(z.union([z.string(), z.number(), z.boolean()])),
          })
          .optional(),
        indices: z.array(z.number().int().nonnegative()).optional(),
      },
    },
    async (args) => {
      try {
        return jsonResult(
          await client.resolvePoolResponse(args.id, {
            mode: args.mode,
            path: args.path,
            select: args.select,
            indices: args.indices,
          })
        );
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.registerTool(
    'mockifyer_set_pool_ref',
    {
      description:
        'Embed a $pool reference into a scenario mock response (entire body or at a JSON path). Serve-time resolve loads the promoted fixture.',
      inputSchema: {
        filename: z.string().describe('Mock filename relative to the scenario folder'),
        scenario: z.string().optional(),
        path: z
          .string()
          .nullable()
          .optional()
          .describe('Path within response.data to set; omit/null replaces entire response.data'),
        pool: z.object({
          id: z.string(),
          mode: z.enum(['document', 'value']).optional(),
          path: z.string().optional(),
          select: z
            .object({
              field: z.string(),
              values: z.array(z.union([z.string(), z.number(), z.boolean()])),
            })
            .optional(),
          indices: z.array(z.number().int().nonnegative()).optional(),
        }),
      },
    },
    async (args) => {
      try {
        return jsonResult(
          await client.setMockPoolRef(args.filename, {
            pool: args.pool,
            path: args.path ?? null,
            scenario: args.scenario,
          })
        );
      } catch (error) {
        return toolError(error instanceof Error ? error.message : String(error));
      }
    }
  );

  return server;
}

/** Start the Mockifyer MCP server on stdio (for Cursor / Claude Desktop). */
export async function runMockifyerMcpServer(client?: DashboardApiClient): Promise<void> {
  const dashboard = client ?? new DashboardApiClient();
  const server = createMockifyerMcpServer(dashboard);
  const transport = new StdioServerTransport();

  console.error(`[mockifyer-mcp] Dashboard API: ${dashboard.apiBase}`);

  await server.connect(transport);

  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });
}
