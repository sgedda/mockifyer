# Mockifyer Browser Example (Vite + TypeScript)

⚠️ **Note**: This example demonstrates browser support coming in the next Mockifyer release. The browser-optimized build is included in PR #495.

## What This Demonstrates

- ✅ Memory provider with preloaded fixtures
- ✅ Mocked request (currency rates from fixture)
- ✅ Unmocked request (IP lookup from network)
- ✅ Zero Node.js built-ins in browser bundle
- ✅ Clean TypeScript setup with Vite

## Run Locally (Development)

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
# Open http://localhost:5173
```

## After Release

Once `@sgedda/mockifyer-fetch@1.8.108+` is published with browser support, this example will work on StackBlitz and CodeSandbox using published packages:

```bash
npm install @sgedda/mockifyer-core@latest @sgedda/mockifyer-fetch@latest
npm run dev
```

The browser-optimized build will be automatically selected via the `browser` field in package.json.

## How It Works

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-fetch'
import rates from './fixtures/rates.json'

setupMockifyer({
  mockDataPath: './mock-data',
  databaseProvider: {
    type: 'memory',
    options: {
      fixtures: [rates]  // Preload fixtures
    }
  },
  recordMode: false,
  failOnMissingMock: false,  // Allow passthrough
  useGlobalFetch: true       // Patch global fetch
})

// Mocked: uses fixture
const rates = await fetch('https://api.frankfurter.dev/v1/latest')

// Unmocked: goes to network
const ip = await fetch('https://api.ipify.org?format=json')
```

See `src/main.ts` for the complete implementation.
