# Mockifyer Monorepo Structure

This directory contains the monorepo packages for Mockifyer:

## Packages

### `mockifyer-core`
Shared core utilities, types, and base HTTP client implementation.

**Exports:**
- Types: `MockifyerConfig`, `StoredRequest`, `StoredResponse`, `MockData`
- HTTP Client Types: `HTTPClient`, `HTTPRequestConfig`, `HTTPResponse`
- Base Class: `BaseHTTPClient`
- Utilities: `mock-matcher`, `date`

### `mockifyer-axios`
Axios-specific implementation of Mockifyer.

**Dependencies:**
- `@sgedda/mockifyer-core` (workspace dependency)
- `axios` (peerDependency)
- `axios-mock-adapter` (dependency)

**Features:**
- Axios-only HTTP client implementation
- Global axios patching (`useGlobalAxios: true`)
- Mock recording and replay for axios requests

### `mockifyer-fetch`
Fetch-specific implementation of Mockifyer.

**Dependencies:**
- `@sgedda/mockifyer-core` (workspace dependency)

**Features:**
- Fetch-only HTTP client implementation
- Global fetch patching (`useGlobalFetch: true`)
- Mock recording and replay for fetch requests

## Setup

1. Build core package first:
```bash
cd packages/mockifyer-core
npm install
npm run build
```

2. Build axios package:
```bash
cd packages/mockifyer-axios
npm install
npm run build
```

## Usage

### Axios
```typescript
import { setupMockifyer } from '@sgedda/mockifyer-axios';
import axios from 'axios';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: true,
  useGlobalAxios: true,
  axiosInstance: axios
});

// Now axios.get(), axios.post(), etc. are automatically intercepted
const response = await axios.get('https://api.example.com/data');
```

### Fetch
```typescript
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: true,
  useGlobalFetch: true
});

// Now fetch() calls are automatically intercepted
const response = await fetch('https://api.example.com/data');
const data = await response.json();
```

## Next Steps

The `mockifyer-axios` package needs the full implementation extracted from `src/index.ts`:
- Remove all fetch-related code
- Update imports to use `@sgedda/mockifyer-core`
- Simplify `httpClientType` checks (always 'axios')
- Remove fetch-specific adapter logic

