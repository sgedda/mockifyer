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
- `--provider <provider>` - Database provider type (currently only 'filesystem' supported)

### Environment Variables

- `MOCKIFYER_PATH` - Path to mock data directory
- `MOCKIFYER_DB_PROVIDER` - Database provider type
- `MOCKIFYER_DASHBOARD_BASE` - Same as `--base` (e.g. `/dashboard`) for the standalone server

### Subpath / embedding (e.g. `/dashboard`)

The default UI build uses a **portable** Vite base (`./`): the same `public/` works at **`/`** or when mounted under **`/dashboard`** (no extra build for that path). The app infers the mount for React Router and `/api` from the main bundle script URL.

**Optional:** root-absolute assets — `VITE_MOCKIFYER_DASHBOARD_BASE=/ npm run build`. Fixed subpath in the bundle — e.g. `VITE_MOCKIFYER_DASHBOARD_BASE=/dashboard/ npm run build` (mount Express at the same path).

**Standalone CLI** under a prefix:

```bash
npx mockifyer-dashboard --base /dashboard
```

**Embed** in another Express app:

```ts
app.use('/dashboard', createServer(publicDir, mockDataPath, config))
```

Use the **`public/`** shipped with `npm install @sgedda/mockifyer-dashboard` (default portable build) unless you chose a fixed `VITE_*` base above.

#### API Management / reverse proxies (extra path segments)

If users reach the UI through a **gateway prefix** (e.g. Azure APIM: `/mobile-app/capp-graphql/preprd/v-2/dashboard/…`), the browser loads your JS from a URL like:

`/mobile-app/capp-graphql/preprd/v-2/dashboard/assets/…`

The portable build infers the **full** path before `/assets/` and calls APIs under that same prefix (e.g. `…/dashboard/api/...`).

That only works if **your Node app actually mounts the dashboard at that full path**:

```ts
app.use(
  '/mobile-app/capp-graphql/preprd/v-2/dashboard',
  createServer(publicDir, mockDataPath, config)
)
```

—or APIM (or another proxy) **rewrites** incoming URLs so the backend sees the path you did mount (e.g. strip the gateway prefix down to `/dashboard` **and** ensure HTML/JS are still served under URLs consistent with that, which is harder).

If Express is mounted only at `/dashboard` while the public URL is longer, you get **404** on HTML, assets, or `/api` because the paths do not line up.

Also ensure APIM routes **`…/dashboard/api/*`** to the same backend as the UI (not only `/graphql`).

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

