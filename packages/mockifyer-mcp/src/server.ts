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
