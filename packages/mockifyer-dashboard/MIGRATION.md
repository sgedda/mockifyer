# Dashboard Migration to React + shadcn/ui

The Mockifyer Dashboard has been migrated from vanilla HTML/JS to React + shadcn/ui for a modern, maintainable codebase.

## What Changed

- **Frontend**: Migrated from vanilla HTML/JS to React 18 + TypeScript
- **UI Framework**: Using shadcn/ui components with Tailwind CSS
- **Build Tool**: Vite for fast development and optimized production builds
- **Theme**: Modern dark theme with shadcn/ui components

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn

### First Time Setup

1. **Install frontend dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Install backend dependencies (if not already done):**
   ```bash
   npm install
   ```

### Running in Development

**Option 1: Run frontend and backend separately**

Terminal 1 (Backend):
```bash
npm run dev
```

Terminal 2 (Frontend):
```bash
npm run dev:frontend
```

**Option 2: Run both together**
```bash
npm run dev:all
```

The frontend dev server runs on `http://localhost:5173` and proxies API requests to the backend at `http://localhost:3002`.

### Building for Production

```bash
npm run build
```

This will:
1. Build the React frontend to `public/` directory
2. Build the TypeScript backend to `dist/` directory

### Running Production Build

```bash
npm start
```

## Project Structure

```
packages/mockifyer-dashboard/
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/   # React components
│   │   │   ├── ui/       # shadcn/ui components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── MockList.tsx
│   │   │   ├── MockEditor.tsx
│   │   │   ├── StatsView.tsx
│   │   │   └── Settings.tsx
│   │   ├── lib/          # Utilities and API client
│   │   ├── types/        # TypeScript types
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── src/                   # Express backend (unchanged)
├── public/                # Build output (React app)
└── package.json
```

## Features

The new React dashboard includes all the same features:

- ✅ View list of all mock files
- ✅ Search and filter mocks
- ✅ View and edit mock data (request/response)
- ✅ Delete and duplicate mocks
- ✅ View statistics (files, endpoints, methods, status codes)
- ✅ Scenario management
- ✅ Real-time updates

## UI Improvements

- Modern dark theme with shadcn/ui components
- Responsive design
- Better code editor for JSON editing
- Improved visual hierarchy
- Toast notifications for user feedback
- Tabbed interface for better organization

## Migration Notes

- Old HTML files (`index.html`, `request-flow.html`) are preserved in `public/` but not used
- API endpoints remain unchanged - no backend changes required
- The React build outputs to `public/` directory, overwriting the old `index.html`

