import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { DASHBOARD } from './env';

/** The checkout's MCP server build (packages/mockifyer-mcp/dist/cli.js). */
export const DEMO_MCP_CLI = path.resolve(__dirname, '../../packages/mockifyer-mcp/dist/cli.js');

/** Call Mockifyer MCP tools directly over stdio, no AI agent involved. */
export async function withMcp<T>(fn: (call: (tool: string, args?: Record<string, unknown>) => Promise<string>, tools: string[]) => Promise<T>,
  opts: { cli?: string; dashboardUrl?: string } = {}): Promise<T> {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [opts.cli ?? DEMO_MCP_CLI],
    env: { ...(process.env as Record<string, string>), MOCKIFYER_DASHBOARD_URL: opts.dashboardUrl ?? DASHBOARD },
    stderr: 'ignore',
  });
  const client = new Client({ name: 'mockifyer-e2e', version: '0.1.0' });
  await client.connect(transport);
  try {
    const tools = (await client.listTools()).tools.map((t) => t.name);
    const call = async (tool: string, args: Record<string, unknown> = {}) => {
      const r: any = await client.callTool({ name: tool, arguments: args });
      const text = (r.content ?? []).map((c: any) => c.text ?? '').join('\n');
      if (r.isError) throw new Error(`${tool} failed: ${text}`);
      return text;
    };
    return await fn(call, tools);
  } finally {
    await client.close();
  }
}
