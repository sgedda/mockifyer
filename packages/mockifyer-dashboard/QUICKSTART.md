# Quick Start Guide - Mockifyer Dashboard

## First Time Setup

### 1. Install Frontend Dependencies

```bash
cd packages/mockifyer-dashboard/frontend
npm install
```

### 2. Install Backend Dependencies (if not already done)

```bash
cd packages/mockifyer-dashboard
npm install
```

## Running in Development

You have two options:

### Option A: Run Both Together (Recommended)

```bash
cd packages/mockifyer-dashboard
npm run dev:all
```

This runs both the backend (port 3002) and frontend (port 5173) simultaneously.

### Option B: Run Separately (Two Terminals)

**Terminal 1 - Backend:**
```bash
cd packages/mockifyer-dashboard
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd packages/mockifyer-dashboard/frontend
npm run dev
```

## Access the Dashboard

- **Frontend (React App):** http://localhost:5173
- **Backend API:** http://localhost:3002

The frontend automatically proxies API requests to the backend.

## Production Build

### Build Everything

```bash
cd packages/mockifyer-dashboard
npm run build
```

This will:
1. Install frontend dependencies (if needed)
2. Build the React app to `public/` directory
3. Build the TypeScript backend to `dist/` directory

### Run Production Build

```bash
npm start
```

The dashboard will be available at http://localhost:3002

## Troubleshooting

### Port Already in Use

If port 3002 or 5173 is already in use:

**Backend:** Use `--port` flag:
```bash
npm run dev -- --port 3002
```

**Frontend:** Edit `frontend/vite.config.ts` and change the port:
```typescript
server: {
  port: 5174, // Change this
  // ...
}
```

### Frontend Can't Connect to Backend

Make sure:
1. Backend is running on port 3002
2. Frontend proxy is configured correctly in `vite.config.ts`
3. No CORS issues (backend has CORS enabled for localhost)

### Build Errors

If you get build errors:
1. Make sure all dependencies are installed: `cd frontend && npm install`
2. Clear node_modules and reinstall: `rm -rf node_modules && npm install`
3. Check Node.js version (requires 18+)

