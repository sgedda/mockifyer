# @sgedda/mockifyer-fetch

HTTP mock record/replay for `fetch` API with in-memory provider support for browser and Expo web.

## Installation

```bash
npm install @sgedda/mockifyer-fetch @sgedda/mockifyer-core
```

## Node.js Usage

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

const mockifyer = setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: false,
  useGlobalFetch: true
});

// Your fetch calls are now mocked
const response = await fetch('https://api.example.com/data');
```

## Browser & Expo Web Usage

Mockifyer works in browsers and Expo web builds with the memory provider and preloaded fixtures.

### Requirements

- Only the `memory` provider is supported (no filesystem/Redis/SQLite in browsers)
- Fixtures must be preloaded via `databaseProvider.options.fixtures`
- Uses Web Crypto API for hashing (or pure-JS fallback)

### Browser Example

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import rates from './fixtures/api.frankfurter.dev/v1/latest.json';

const mockifyer = setupMockifyer({
  mockDataPath: './fixtures',
  databaseProvider: {
    type: 'memory',
    options: {
      fixtures: [rates]  // Preload your mock data
    }
  },
  recordMode: false,
  failOnMissingMock: true,  // Recommended for testing
  useGlobalFetch: true       // Patch global fetch
});

// Fetch will use the preloaded mock
const response = await fetch('https://api.frankfurter.dev/v1/latest');
const data = await response.json();
console.log(data);  // Returns your mock data
```

### Expo Web Example

```javascript
// App.js
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import frankfurterRates from './fixtures/frankfurter-rates.json';

export default function App() {
  useEffect(() => {
    // Initialize mockifyer on mount
    setupMockifyer({
      mockDataPath: './fixtures',
      databaseProvider: {
        type: 'memory',
        options: {
          fixtures: [frankfurterRates]
        }
      },
      recordMode: false,
      failOnMissingMock: true,
      useGlobalFetch: true
    });
  }, []);

  const fetchData = async () => {
    const response = await fetch('https://api.frankfurter.dev/v1/latest');
    const data = await response.json();
    console.log(data);  // Returns your mock data
  };

  // ... rest of your component
}
```

### Fixture Format

Fixtures are JSON files with this structure:

```json
{
  "request": {
    "method": "GET",
    "url": "https://api.example.com/endpoint",
    "headers": {},
    "queryParams": {}
  },
  "response": {
    "status": 200,
    "headers": {
      "content-type": "application/json"
    },
    "data": {
      "result": "your mock data here"
    }
  },
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

### Bundler Configuration

Mockifyer uses package.json `browser` field mappings to automatically resolve browser-safe modules. Modern bundlers (Metro, Vite, webpack, esbuild) honor these mappings automatically.

**Metro (Expo)**:
- Works out of the box with `npx expo export --platform web`
- Uses the browser entry point automatically

**Vite**:
- Add `conditions: ['browser']` to your config if needed

**webpack**:
- The `browser` field is respected by default

### Browser Compatibility

- ✅ Chrome, Firefox, Safari, Edge (modern versions)
- ✅ Expo web (Metro bundler)
- ✅ Vite, webpack, esbuild (with `platform: 'browser'`)
- ❌ Node.js built-ins are not available (fs, path, crypto → Web Crypto)
- ❌ Redis, SQLite providers not supported (use `memory` only)

### Limitations in Browser

- **No local filesystem recording**. Record through the dashboard proxy or in Node.
- No Redis/SQLite support
- All fixtures must be preloaded at initialization
- Request correlation is simplified (header-only)
- No Atlas HTML generation
- No screenshot capture

**Dashboard proxy in the browser:** Set `proxy.baseUrl` (for example `http://localhost:3002`) in `setupMockifyer`. The browser build sends requests to the dashboard's `/api/proxy` using `fetch`, so you can record and replay through the dashboard without Node. `initMockifyerForDashboardProxy` and `initMockifyerForDashboardProxyClients` are not available in browser builds, so use `setupMockifyer` from the browser entry.

### See Also

- [@sgedda/mockifyer-core](../mockifyer-core/README.md) - Core types and providers
- [Full documentation](https://mockifyer.dev)
- [GitHub repository](https://github.com/sgedda/mockifyer)
