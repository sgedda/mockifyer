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
- `--base <path>` - Mount the app under this URL path (default: `/`). Must match `VITE_MOCKIFYER_DASHBOARD_BASE` used when building the frontend.
- `--provider <provider>` - Database provider type (currently only 'filesystem' supported)

### Environment Variables

- `MOCKIFYER_PATH` - Path to mock data directory
- `MOCKIFYER_DB_PROVIDER` - Database provider type
- `MOCKIFYER_DASHBOARD_BASE` - Same as `--base` (e.g. `/dashboard`) for the standalone server

### Subpath / embedding (e.g. `/dashboard`)

Asset and API URLs are fixed at **frontend build time**. Default is root (`/`).

1. **Build** the UI with a public base path (trailing slash optional; it is normalized):

   ```bash
   VITE_MOCKIFYER_DASHBOARD_BASE=/dashboard/ npm run build
   ```

2. **Standalone CLI**: mount the server at the same path:

   ```bash
   MOCKIFYER_DASHBOARD_BASE=/dashboard npx mockifyer-dashboard
   # or
   npx mockifyer-dashboard --base /dashboard
   ```

3. **Embed in another Express app**: use the same built `public/` folder and `app.use('/dashboard', createServer(publicDir, mockDataPath, …))` with a matching build (`/dashboard/`).

If the build uses `/` (default) but the server is only mounted at `/dashboard`, browsers will request `/assets/...` and `/api/...` at the host root and the UI will not load correctly.

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

