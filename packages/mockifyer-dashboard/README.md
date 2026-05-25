# Mockifyer Dashboard

Standalone CLI dashboard for viewing and managing Mockifyer mock data.

## Installation

```bash
npm install -g @sgedda/mockifyer-dashboard
```

Or use with `npx` (no installation required):

```bash
npx @sgedda/mockifyer-dashboard
```

## Usage

### Basic Usage

```bash
# Auto-detect mock data path
npx mockifyer-dashboard

# Explicit path
npx mockifyer-dashboard --path ./mock-data

# Custom port
npx mockifyer-dashboard --port 8080

# Don't open browser automatically
npx mockifyer-dashboard --no-open

# Serve under a URL prefix (e.g. /dashboard) — must match frontend build (see below)
npx mockifyer-dashboard --base /dashboard
```

### Options

- `-p, --path <path>` - Path to mock data directory (default: auto-detected)
- `--port <port>` - Port to run dashboard on (default: 3002)
- `--host <host>` - Host to bind to (default: localhost)
- `--no-open` - Don't open browser automatically
- `--base <path>` - Mount the app under this URL path (default: `/`). With the default **portable** UI build (`./`), the UI infers the mount for routing and `/api` from script URLs. If you built with a **fixed** `VITE_MOCKIFYER_DASHBOARD_BASE` (absolute path), that mount must match.
- `--provider <provider>` - Storage backend: `filesystem` (default), `sqlite`, or `redis`. The HTTP proxy at `/api/proxy` requires `redis`.
- `--redis-url <url>` - Redis URL when using `--provider redis` (or `MOCKIFYER_REDIS_URL`).
- `--key-prefix <prefix>` - Redis key prefix (or `MOCKIFYER_REDIS_KEY_PREFIX`; default `mockifyer:v1`).
- `--redis-mirror-disk` - With `redis`: after recording from upstream, also write `mock-data/<scenario>/redis/<hash>.json` for version control (see env below).
- `--redis-disk-fallback` - With `redis`: if Redis has no mock, scan JSON under `mock-data/<scenario>/` before calling upstream.
- `--redis-disk-dual` - Shorthand for both `--redis-mirror-disk` and `--redis-disk-fallback`.

### Environment Variables

- `MOCKIFYER_PATH` - Path to mock data directory
- `MOCKIFYER_DB_PROVIDER` - Database provider type (`filesystem`, `sqlite`, `redis`)
- `MOCKIFYER_DASHBOARD_BASE` - Same as `--base` (e.g. `/dashboard`) for the standalone server
- `MOCKIFYER_REDIS_URL` - Redis connection URL when using `redis` provider
- `MOCKIFYER_REDIS_KEY_PREFIX` - Redis key prefix (default `mockifyer:v1`)
- `MOCKIFYER_REDIS_MIRROR_DISK` - If `true`/`1`: same as `--redis-mirror-disk` (can combine with CLI / `createServer` config)
- `MOCKIFYER_REDIS_DISK_READ_FALLBACK` - If `true`/`1`: same as `--redis-disk-fallback`

### Subpath / embedding (e.g. `/dashboard`)

The default UI build uses a **portable** Vite base (`./`): the same `public/` works at **`/`** or when mounted under **`/dashboard`** (no extra build for that path). The app infers the mount for React Router and `/api` from the main bundle script URL.

**Optional:** root-absolute assets — `VITE_MOCKIFYER_DASHBOARD_BASE=/ npm run build`. Fixed subpath in the bundle — e.g. `VITE_MOCKIFYER_DASHBOARD_BASE=/dashboard/ npm run build` (mount Express at the same path).

**Standalone CLI** under a prefix:

```bash
npx mockifyer-dashboard --base /dashboard
```

**Embed** in another Express app:

```ts
import { createServer, getDashboardJsonBodyLimit } from '@sgedda/mockifyer-dashboard'

app.use(
  '/dashboard',
  createServer(publicDir, mockDataPath, {
    provider: 'redis',
    redisUrl: process.env.MOCKIFYER_REDIS_URL,
    redisDiskMirror: { mirrorWrites: true, readFallback: true },
  })
)
```

Use the **`public/`** shipped with `npm install @sgedda/mockifyer-dashboard` (default portable build) unless you chose a fixed `VITE_*` base above.

**413 on scenario import when embedding:** your host app’s `express.json()` runs **before** the mounted dashboard and still defaults to ~**100kb**. The dashboard’s own **50mb** limit never applies to that first parse. Either mount the dashboard **before** `app.use(express.json())`, or give the host the same limit, for example:

```ts
import express from 'express'
import { createServer, getDashboardJsonBodyLimit } from '@sgedda/mockifyer-dashboard'

const app = express()
app.use(express.json({ limit: getDashboardJsonBodyLimit() }))
app.use('/mockifyer', createServer(publicDir, mockDataPath, config))
```

## Features

- 📁 **Browse Mock Files** - View all mock files with search and filtering
- ✏️ **Edit Mock Data** - Edit response data with JSON editor
- 📊 **Statistics** - View mock file statistics and usage
- 🔍 **Search** - Search by filename, endpoint, or method
- 💾 **Save Changes** - Save edited mock data back to files
- 🗑️ **Delete Mocks** - Delete unwanted mock files

## Path Detection

The dashboard automatically detects your mock data path by:

1. Checking CLI `--path` argument
2. Checking `MOCKIFYER_PATH` environment variable
3. Walking up the directory tree looking for:
   - `./mock-data`
   - `./persisted/mock-data`
   - `./mock-data.db` (SQLite)
4. Defaulting to `./mock-data`

## Remote Access

The dashboard runs locally by default. To access from other machines:

```bash
npx mockifyer-dashboard --host 0.0.0.0
```

⚠️ **Note**: The dashboard reads files directly from the filesystem, so it must run on the same machine where your mock data files are located. For remote access, you would need to run the dashboard on the server and access it via network.

## MCP (Cursor / Claude Desktop)

Use [`@sgedda/mockifyer-mcp`](../mockifyer-mcp) to expose dashboard APIs as MCP tools — including **`mockifyer_get_mock_ai_context`** for lightweight mock projections (avoids sending full response bodies to the AI).

1. Start the dashboard (`npx mockifyer-dashboard --path ./mock-data`).
2. Build the MCP server: `npm --prefix ../mockifyer-mcp run build`.
3. Add to Cursor MCP config — see [mockifyer-mcp README](../mockifyer-mcp/README.md).

## Development

```bash
# Run TypeScript directly (no build needed)
npm run dev

# Run TypeScript with auto-reload on file changes
npm run dev:watch

# Build compiled version
npm run build

# Run compiled version
npm start

# Watch TypeScript files and rebuild
npm run watch
```

### Running TypeScript Directly

You can run the dashboard directly from TypeScript without building:

```bash
# Development mode (TypeScript)
npm run dev

# With options
npm run dev -- --path ./mock-data --port 8080

# Auto-reload on changes
npm run dev:watch
```

This is useful for development as you can make changes and see them immediately without rebuilding.

