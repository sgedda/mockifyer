# mockifyer

Monorepo for **Mockifyer**: libraries for mocking and recording API calls, with special support for date manipulation in tests.

Published packages (install these, not the repo root):

- `@sgedda/mockifyer-core` — types, providers, `getCurrentDate`, etc.
- `@sgedda/mockifyer-axios` — Axios integration (`setupMockifyer`)
- `@sgedda/mockifyer-fetch` — `fetch` integration (`setupMockifyer`)
- `@sgedda/mockifyer-dashboard`, `@sgedda/mockifyer-test-helper` — optional tooling

The root `package.json` is private workspace metadata only (not published). The legacy package is not on [npm](https://www.npmjs.com/); on **GitHub Packages** it appears as [`pkgs/npm/mockifyer`](https://github.com/sgedda/mockifyer/pkgs/npm/mockifyer) (unscoped name `mockifyer` in the API). To remove versions: `scripts/delete-github-packages-legacy-mockifyer.sh` (needs `gh` + `delete:packages`).

## Features

- Record and replay HTTP requests
- Automatic request interception based on environment settings
- Date manipulation utilities for testing
- Support for timezone handling
- Environment variable configuration
- **Easy data discovery**: All captured API responses are stored as searchable JSON files in your project, making it easy to discover what data was captured, where it comes from, and explore all available mock data directly in your IDE

## Installation

```bash
npm install @sgedda/mockifyer-core @sgedda/mockifyer-axios
# or for fetch:
# npm install @sgedda/mockifyer-core @sgedda/mockifyer-fetch
```

## Usage

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-axios';
import { getCurrentDate } from '@sgedda/mockifyer-core';

// Setup mockifyer with configuration
setupMockifyer({
  mockDataPath: './mock-data',
  dateManipulation: {
    fixedDate: '2024-01-01T00:00:00.000Z'
  }
});

// Your API calls will now be intercepted and mocked
const response = await axios.get('https://api.example.com/data');

// Use date manipulation in tests
// IMPORTANT: Use getCurrentDate() instead of new Date() for date manipulation to work
const currentDate = getCurrentDate();
console.log(currentDate.toISOString()); // 2024-01-01T00:00:00.000Z
```

**Important:** For date manipulation to work, you must use Mockifyer's `getCurrentDate()` function instead of `new Date()`. The `getCurrentDate()` function respects your date manipulation settings (fixed date, offset, timezone), while `new Date()` always returns the system date.

## Data Discovery

One of the key benefits of mockifyer is how easy it makes discovering and exploring all the data that was captured during recording. Every API response is automatically saved as a structured JSON file in your `mock-data` directory, making it simple to:

- **Discover all captured data**: Browse through all recorded API responses in one place
- **See where data comes from**: Each file is named with the timestamp, HTTP method, and endpoint URL (e.g., `2025-11-23_10-53-52_GET_v3_football_api_sports_io_standings.json`)
- **Explore available data**: Each mock file contains the complete request (URL, method, headers, query params) and response (status, data, headers) data
- **Search within your IDE**: Since all mocks are stored as JSON files in your project, you can use your IDE's built-in search functionality to quickly find specific endpoints, response data, or API calls

### Mock File Structure

Each mock file contains:
- **Request information**: Method, URL, headers, query parameters, and request body
- **Response data**: Status code, response body, and response headers
- **Metadata**: Timestamp of when the response was captured and optional scenario information

Example mock file:
```json
{
  "request": {
    "method": "GET",
    "url": "https://api.example.com/data",
    "headers": {},
    "queryParams": {}
  },
  "response": {
    "status": 200,
    "data": { /* response data */ },
    "headers": { /* response headers */ }
  },
  "timestamp": "2025-11-23T10:53:52.000Z"
}
```

This structure makes it easy to understand what data is available, trace where it came from, and reuse it in your tests or development workflow.

## Date Configuration

Mockifyer provides powerful date manipulation features that are especially useful for testing time-dependent functionality. Here are the different ways to configure date behavior:

### 1. Fixed Date

Set a specific date for all date operations:

```typescript
setupMockifyer({
  mockDataPath: './mock-data',
  dateManipulation: {
    fixedDate: '2024-12-25T12:00:00Z' // Christmas 2024
  }
});

console.log(getCurrentDate().toISOString()); // 2024-12-25T12:00:00.000Z
```

### 2. Date Offset

Set a relative offset from the current date:

```typescript
setupMockifyer({
  mockDataPath: './mock-data',
  dateManipulation: {
    offset: 2 * 24 * 60 * 60 * 1000 // 2 days in the future
  }
});

// If today is 2024-03-16, this will return 2024-03-18
console.log(getCurrentDate().toISOString());
```

### 3. Environment Variables

Control date behavior through environment variables:

```bash
# Set a fixed date
export MOCKIFYER_DATE="2025-01-01T00:00:00Z"

# Or set an offset (in milliseconds)
export MOCKIFYER_DATE_OFFSET="86400000" # 1 day in the future

# Or set a timezone
export MOCKIFYER_TIMEZONE="America/New_York"
```

### 4. Timezone Support

Handle dates in specific timezones:

```typescript
setupMockifyer({
  mockDataPath: './mock-data',
  dateManipulation: {
    timezone: 'America/New_York'
  }
});

// Returns date in New York timezone
console.log(getCurrentDate().toISOString());
```

### Priority Order

Date manipulation settings are applied in the following order:
1. Environment variables (highest priority)
2. Configuration options in `setupMockifyer`
3. System date (fallback)

## Environment Variables

Mockifyer can be configured using the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `MOCKIFYER_ENABLED` | `false` | Enable/disable mockifyer globally |
| `MOCKIFYER_PATH` | `./mock-data` | Path to store mock data files |
| `MOCKIFYER_RECORD_MODE` | `false` | When true, records responses instead of mocking |
| `MOCKIFYER_RECORD_SAME_ENDPOINTS` | `false` | When true, allows recording multiple responses for the same endpoint |
| `MOCKIFYER_USE_SIMILAR_MATCH` | `false` | When true, tries to find similar path matches when exact match fails |
| `MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE` | `false` | When true, verifies response content matches before using similar path match |
| `MOCKIFYER_AUTO_MOCK` | `false` | When true, automatically mocks all requests (fails if no mock found) |

### Dependencies and Interactions

1. **Basic Configuration**
   - `MOCKIFYER_ENABLED` must be `true` for any mocking functionality to work
   - `MOCKIFYER_PATH` is used in both recording and mocking modes

2. **Recording Mode**
   - `MOCKIFYER_RECORD_MODE` controls whether to record or mock responses
   - When recording:
     - `MOCKIFYER_RECORD_SAME_ENDPOINTS` determines if multiple responses for same endpoint are allowed
     - Other mock-related settings are ignored

3. **Mocking Mode**
   - When not in record mode:
     - `MOCKIFYER_USE_SIMILAR_MATCH` enables path-based matching
     - `MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE` adds response verification
     - `MOCKIFYER_AUTO_MOCK` controls fail-fast behavior

4. **Similar Match Flow**
   ```
   MOCKIFYER_USE_SIMILAR_MATCH = true
   └── If exact match fails
       └── If MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE = true
           └── Makes real request and compares responses
       └── If MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE = false
           └── Uses first matching path without verification
   ```

5. **Auto Mock Behavior**
   - When `MOCKIFYER_AUTO_MOCK = true`:
     - All requests must have a matching mock
     - Similar match rules still apply
     - Requests without matches will fail

### Example Configurations

1. **Basic Recording**
   ```bash
   MOCKIFYER_ENABLED=true
   MOCKIFYER_RECORD_MODE=true
   MOCKIFYER_PATH=./mock-data
   ```

2. **Strict Mocking**
   ```bash
   MOCKIFYER_ENABLED=true
   MOCKIFYER_AUTO_MOCK=true
   MOCKIFYER_USE_SIMILAR_MATCH=true
   ```

3. **Flexible Mocking with Verification**
   ```bash
   MOCKIFYER_ENABLED=true
   MOCKIFYER_USE_SIMILAR_MATCH=true
   MOCKIFYER_USE_SIMILAR_MATCH_CHECK_RESPONSE=true
   ```

## Advanced Testing with Sinon

Mockifyer handles HTTP/API mocking, but you can combine it with [Sinon](https://sinonjs.org/) for comprehensive testing:

- **Mockifyer**: Mocks external APIs and handles date manipulation
- **Sinon**: Spies on functions, stubs methods, and mocks internal modules

Together, they provide complete test coverage for both external dependencies and internal code.

See [Testing with Sinon and Mockifyer](./packages/mockifyer-core/TESTING_WITH_SINON.md) for detailed examples and patterns.

**Note:** Sinon is optional - Mockifyer works perfectly on its own. Add Sinon only if you need advanced spying/stubbing capabilities.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT 