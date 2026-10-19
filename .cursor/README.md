# MCP Configuration

This directory contains the [Model Context Protocol](https://modelcontextprotocol.io) configuration for Cursor.

## Quick Start

The default `mcp.json` is pre-configured to work with the Mockifyer MCP server.

### Prerequisites

1. **Build the MCP server** (first time only):
   ```bash
   cd packages/mockifyer-mcp
   npm install
   npm run build
   ```

2. **Start the Mockifyer dashboard**:
   ```bash
   npx mockifyer-dashboard --path ./mock-data
   ```
   
   The dashboard must be running on `http://localhost:3002` (default).

3. **Restart Cursor** or reload MCP servers to activate the configuration.

## Using the MCP Integration

Once configured, you can use natural language in Cursor to interact with your mocks:

- "List all mocks in the default scenario"
- "Search for order-related mocks"
- "Override the booking status to CONFIRMED"
- "Create a new scenario called 'test-checkout' from 'default'"
- "Show me the network trace for request ID xyz"

See [`packages/mockifyer-mcp/README.md`](../packages/mockifyer-mcp/README.md) for full documentation.

## Customization

If you need to customize the configuration (e.g., different dashboard URL, auth credentials):

1. Copy `mcp.json.example` to `mcp.json.local`
2. Modify `mcp.json.local` with your settings
3. The `.local` file is gitignored for personal configurations

### Custom Dashboard URL

```json
{
  "mcpServers": {
    "mockifyer": {
      "command": "node",
      "args": ["./packages/mockifyer-mcp/dist/cli.js"],
      "env": {
        "MOCKIFYER_DASHBOARD_URL": "http://custom-host:8080",
        "MOCKIFYER_DASHBOARD_BASE": "/dashboard"
      }
    }
  }
}
```

### Using NPX (Alternative)

Instead of the local built version, you can use the published npm package:

```json
{
  "mcpServers": {
    "mockifyer": {
      "command": "npx",
      "args": ["@sgedda/mockifyer-mcp"],
      "env": {
        "MOCKIFYER_DASHBOARD_URL": "http://localhost:3002"
      }
    }
  }
}
```

## Troubleshooting

### MCP server not connecting

1. Verify the dashboard is running: `curl http://localhost:3002/health`
2. Check the build output exists: `ls packages/mockifyer-mcp/dist/cli.js`
3. View MCP logs in Cursor's output panel (View → Output → MCP)

### Path issues

The configuration uses a relative path (`./packages/mockifyer-mcp/dist/cli.js`) which works when Cursor's workspace root is the monorepo root. If you're using a different workspace setup, adjust the path accordingly.
