// Scripted MCP client (no AI model): calls one Mockifyer MCP tool over stdio and prints the result.
// usage: node mcp-demo.mjs <tool> '<json args>'     (run from the mockifyer repo; needs packages/mockifyer-mcp built)
import path from 'node:path';
import { createRequire } from 'node:module';
const repo = process.env.MOCKIFYER_REPO ?? process.cwd();
const mcpPkg = path.join(repo, 'packages/mockifyer-mcp');
const req = createRequire(path.join(mcpPkg, 'package.json'));
const { Client } = await import(req.resolve('@modelcontextprotocol/sdk/client/index.js'));
const { StdioClientTransport } = await import(req.resolve('@modelcontextprotocol/sdk/client/stdio.js'));
const [,, tool, argsJson = '{}'] = process.argv;
const t = new StdioClientTransport({ command: 'node', args: [path.join(mcpPkg, 'dist/cli.js')],
  env: { ...process.env, MOCKIFYER_DASHBOARD_URL: process.env.MOCKIFYER_DASHBOARD_URL ?? 'http://127.0.0.1:3002' }, stderr: 'ignore' });
const c = new Client({ name: 'demo', version: '1' }); await c.connect(t);
if (tool === 'tools') { const r = await c.listTools(); console.log(r.tools.map(x => x.name).join('\n')); }
else { const r = await c.callTool({ name: tool, arguments: JSON.parse(argsJson) }); console.log(r.content.map(x => x.text).join('\n')); }
await c.close();
