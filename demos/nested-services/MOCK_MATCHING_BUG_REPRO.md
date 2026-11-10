# Mockifyer Bug: Mock Matching Failure Due to Query Param Redaction Mismatch

## Summary

Mocks recorded with redacted query params (`key=***`) cannot be replayed because the request key generation doesn't apply the same redaction during replay lookup.

## Root Cause

1. **During recording**: URLs are sanitized with `sanitizeUrlString()` which replaces sensitive query params with `***` before saving to the mock file
2. **During replay**: `generateRequestKey()` uses the original (non-sanitized) URL with `key=demo` to generate the lookup key  
3. **Result**: Request key `GET:https://...?key=demo&q=london` doesn't match the mock's request key `GET:https://...?key=***&q=london`

## Evidence

### Recorded Mock
```json
{
  "request": {
    "method": "GET",
    "url": "https://api.weatherapi.com/v1/current.json?key=***&q=London",
    "queryParams": null
  },
  "response": {
    "status": 200,
    "data": {...}
  }
}
```

### Replay Request
```javascript
await fetch('https://api.weatherapi.com/v1/current.json?key=demo&q=London');
```

### Error
```
Error: No mock data found for request: GET:https://api.weatherapi.com/v1/current.json?key=***&q=London
```

(Note: The `key=***` in the error message suggests Mockifyer IS trying to match with redaction, but the mock file still isn't found)

## Code Analysis

### Recording: `network-log.ts`
```typescript
const SENSITIVE_QUERY_PARAMS = ['api_key', 'apikey', 'token', 'access_token', 'password', 'secret'];

export function sanitizeQueryString(query: string | undefined): string | undefined {
  const params = new URLSearchParams(trimmed);
  for (const key of [...params.keys()]) {
    if (SENSITIVE_QUERY_PARAMS.includes(key.toLowerCase())) {
      params.set(key, REDACTED_SECRET_PLACEHOLDER); // '[REDACTED]'
      changed = true;
    }
  }
  return params.toString();
}
```

**Note**: `key` is NOT in `SENSITIVE_QUERY_PARAMS`, so why is it being redacted to `***`?

### Replay: `mock-matcher.ts`  
```typescript
export function generateRequestKey(request: StoredRequest): string {
  const normalizedMethod = (request.method || 'GET').toUpperCase();
  let normalizedUrl = (request.url || '').toLowerCase();
  
  // No sanitization happens here!
  
  let queryString = '';
  if (hasParams && request.queryParams) {
    queryString = new URLSearchParams(normalizedParams).toString();
  }
  
  return `${normalizedMethod}:${normalizedUrl}${queryString ? '?' + queryString : ''}`;
}
```

## Minimal Reproduction

### Setup
```bash
cd demos/nested-services
npm install
node stubs.js &  # Start local services on :3003
```

### Record
```javascript
// record-repro.js
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

setupMockifyer({
  recordMode: true,
  mockDataPath: './repro-mocks',
  defaultScenario: 'default',
  provider: 'filesystem',
  useGlobalFetch: true,
});

const res = await fetch('http://localhost:3003/weather?key=demo&city=London');
await res.json();
await new Promise(r => setImmediate(r));

// Check: cat repro-mocks/default/localhost/weather/*.json
// URL will have key=*** or key=demo depending on the bug
```

### Replay
```javascript
// replay-repro.js
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

setupMockifyer({
  recordMode: false,
  mockDataPath: './repro-mocks',
  defaultScenario: 'default',
  provider: 'filesystem',
  useGlobalFetch: true,
  failOnMissingMock: true,
});

const res = await fetch('http://localhost:3003/weather?key=demo&city=London');
const data = await res.json();
console.log('Success:', data);
```

**Expected**: Replay succeeds  
**Actual**: `Error: No mock data found for request`

## Questions for Core Team

1. Why is `key` being redacted to `***` when it's not in `SENSITIVE_QUERY_PARAMS`?
2. Is `***` a different redaction mechanism than `[REDACTED]`?
3. Should `generateRequestKey()` call `sanitizeUrlString()` to ensure consistent matching?
4. Or should recording NOT redact the URL that goes into `request.url` (only redact for display/logs)?

## Impact

Any API that uses query parameters like `?key=...`, `?apiKey=...`, `?api_key=...` etc. cannot be mocked because the recorded URL doesn't match the replay URL.

This affects:
- weatherapi.com (`?key=...`)
- geoapify.com (`?apiKey=...`)
- Many other APIs with key-based authentication

## Suggested Fix

### Option 1: Sanitize During Matching
```typescript
export function generateRequestKey(request: StoredRequest): string {
  const normalizedMethod = (request.method || 'GET').toUpperCase();
  let normalizedUrl = sanitizeUrlString(request.url || '').toLowerCase();
  // ... rest of function
}
```

### Option 2: Don't Sanitize During Recording
Store the original URL in `request.url` for matching, and only sanitize for display/logging purposes.

### Option 3: Normalize During Lookup
When searching for matching mocks, sanitize both the incoming request URL and all candidate mock URLs before comparing.

## Workaround

Use keyless APIs or local stub services that don't require authentication query params.
