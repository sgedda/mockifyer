# Build Utils Examples

This directory contains examples showing how to use Mockifyer build utilities in various frameworks and build systems.

## Examples

### `build-example.ts`
Standalone example showing all build utility functions.

**Run:**
```bash
npm run example:build
```

### `nextjs-example.ts`
Example for Next.js static site generation using `getStaticProps` and `generateStaticParams`.

**Usage:**
- Copy the relevant functions to your Next.js pages or app directory
- Adjust the `mockDataPath` to point to your mock data directory

### `gatsby-example.ts`
Example for Gatsby static site generation using `sourceNodes` and `createPages`.

**Usage:**
- Copy the functions to your `gatsby-node.ts` file
- Adjust the `mockDataPath` to point to your mock data directory

### `vite-build-example.ts`
Example Vite plugin for generating static data files during build.

**Usage:**
```typescript
// vite.config.ts
import { mockifyerBuildPlugin } from '@sgedda/mockifyer-core/examples/vite-build-example';

export default {
  plugins: [
    mockifyerBuildPlugin({
      mockDataPath: './mock-data',
      outputPath: './dist/static-data.json'
    })
  ]
};
```

### `react-native-setup.ts`
Example conditional setup for React Native apps that:
- Uses Expo FileSystem provider in development (Metro) - can record mocks
- Uses Memory provider with bundled TypeScript file in production builds

**Usage:**
- Copy to your React Native project as `mockifyer-setup.ts`
- Import and call `initializeMockifyer()` in your `App.tsx`
- See [REACT_NATIVE_BUILD_WORKFLOW.md](../REACT_NATIVE_BUILD_WORKFLOW.md) for complete workflow

### `react-native-build-script.ts`
Build script for generating TypeScript mock data file from recorded mocks.

**Usage:**
```bash
# Add to package.json
"generate:build-data": "ts-node scripts/generate-build-data.ts"

# Run before building
npm run generate:build-data
npm run build:ios
```

**Workflow:**
1. Record mocks during development using Expo FileSystem provider
2. Extract recorded files from device to `project/mock-data/`
3. Run this script to generate `assets/mock-data.ts`
4. Build app - Metro bundles the TypeScript file
5. App uses Memory provider with bundled data at runtime

### `generate-typescript-data.ts`
Simple example showing how to generate a TypeScript file from mock data.

**Usage:**
```bash
ts-node examples/generate-typescript-data.ts
```

**Output:**
Generates `assets/mock-data.ts` with:
```typescript
export const mockData = [
  {
    request: { method, url, headers, ... },
    response: { status, data, headers },
    timestamp: "...",
    scenario: undefined,
    // ... optional fields
  }
] as const;
```

**Use in your app:**
```typescript
import { mockData } from './assets/mock-data';
```

## Quick Start

```typescript
import { loadMockDataForBuild } from '@sgedda/mockifyer-core/utils/build-utils';

// Load mock data during build
const mockData = loadMockDataForBuild({
  mockDataPath: './mock-data',
  filter: (filename, data) => data.request.method === 'GET',
  transform: (data) => data.response.data
});

// Use in your build process
console.log(`Loaded ${mockData.count} items`);
console.log(mockData.data);
```

## Documentation

See [BUILD_UTILS.md](../BUILD_UTILS.md) for complete API documentation.

