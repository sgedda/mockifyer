# @sgedda/mockifyer-core

Core utilities and types for Mockifyer — HTTP mock record & replay for Node.js and React Native.

## Overview

`@sgedda/mockifyer-core` provides the foundation for recording and replaying HTTP requests as JSON mocks. It includes:

- Mock storage and retrieval (filesystem, Redis, SQLite)
- Scenario management and switching
- GraphQL query normalization and matching
- Date/time manipulation for deterministic tests
- Request/response interception utilities
- TypeScript types and interfaces

Most users should install **[@sgedda/mockifyer-axios](https://www.npmjs.com/package/@sgedda/mockifyer-axios)** or **[@sgedda/mockifyer-fetch](https://www.npmjs.com/package/@sgedda/mockifyer-fetch)** instead, which wrap this core package with HTTP client-specific integrations.

## Installation

```bash
npm install @sgedda/mockifyer-core
```

## Quick Start

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-core';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: false, // Set to true to record new mocks
  scenario: 'default',
});
```

## Documentation

Full documentation is available at **[mockifyer.dev](https://mockifyer.dev)**:

- [Getting Started](https://mockifyer.dev/getting-started)
- [Configuration Reference](https://mockifyer.dev/config-reference)
- [E2E Tutorial](https://mockifyer.dev/e2e-tutorial)
- [Features](https://mockifyer.dev/features)

## Related Packages

- **[@sgedda/mockifyer-axios](https://www.npmjs.com/package/@sgedda/mockifyer-axios)** — Record and replay axios HTTP calls
- **[@sgedda/mockifyer-fetch](https://www.npmjs.com/package/@sgedda/mockifyer-fetch)** — Record and replay fetch (node-fetch, undici, React Native)
- **[@sgedda/mockifyer-dashboard](https://www.npmjs.com/package/@sgedda/mockifyer-dashboard)** — Local UI and CLI for browsing and editing mocks

## License

MIT

## Repository

[https://github.com/sgedda/mockifyer](https://github.com/sgedda/mockifyer)
