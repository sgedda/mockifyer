# Build Utils - Using Mock Data During Builds

The `build-utils` module provides utilities for using mock data during build processes, such as static site generation, build-time data fetching, and embedding mock data into build output.

## Installation

```bash
npm install @sgedda/mockifyer-core
```

## Usage Examples

### Next.js Static Site Generation

```typescript
// pages/posts.tsx or app/posts/page.tsx
import { loadMockDataForBuild } from '@sgedda/mockifyer-core/utils/build-utils';

export async function getStaticProps() {
  const mockData = loadMockDataForBuild({
    mockDataPath: './mock-data',
    filter: (filename, data) => {
      // Only include GET requests to /api/posts
      return data.request.method === 'GET' && 
             data.request.url.includes('/api/posts');
    },
    transform: (data) => {
      // Return only the response data
      return data.response.data;
    }
  });

  return {
    props: {
      posts: mockData.data
    }
  };
}
```

### Gatsby Static Queries

```typescript
// gatsby-node.ts
import { loadMockDataForBuild } from '@sgedda/mockifyer-core/utils/build-utils';

export async function sourceNodes({ actions, createNodeId, createContentDigest }) {
  const { createNode } = actions;
  const mockData = loadMockDataForBuild({
    mockDataPath: './mock-data',
    transform: (data) => data.response.data
  });

  mockData.data.forEach((item, index) => {
    const node = {
      id: createNodeId(`mock-data-${index}`),
      ...item,
      internal: {
        type: 'MockData',
        contentDigest: createContentDigest(item)
      }
    };
    createNode(node);
  });
}
```

### Generate Static Data File

```typescript
// scripts/generate-static-data.ts
import { generateStaticDataFile } from '@sgedda/mockifyer-core/utils/build-utils';

generateStaticDataFile({
  mockDataPath: './mock-data',
  outputPath: './public/static-data.json',
  filter: (filename, data) => data.request.method === 'GET',
  transform: (data) => ({
    url: data.request.url,
    response: data.response.data
  }),
  format: 'json' // or 'typescript' or 'javascript'
});
```

### Generate TypeScript Types

```typescript
// scripts/generate-types.ts
import { generateTypesFromMockData } from '@sgedda/mockifyer-core/utils/build-utils';

generateTypesFromMockData({
  mockDataPath: './mock-data',
  outputPath: './types/mock-data.d.ts',
  typeName: 'ApiResponse',
  filter: (filename, data) => data.request.method === 'GET'
});
```

### Pre-process and Group Data

```typescript
import { preprocessMockDataForBuild } from '@sgedda/mockifyer-core/utils/build-utils';

const processed = preprocessMockDataForBuild({
  mockDataPath: './mock-data',
  groupBy: 'endpoint', // Group by endpoint URL
  sortBy: 'timestamp',
  sortOrder: 'desc',
  transform: (data) => data.response.data
});

// Access grouped data
console.log(processed.grouped['/api/posts']); // Array of posts
console.log(processed.grouped['/api/users']); // Array of users

// Or access flat array
console.log(processed.data); // All items in sorted order
```

### Quick Lookup by URL

```typescript
import { getMockDataByUrl, getMockDataByMethodAndUrl } from '@sgedda/mockifyer-core/utils/build-utils';

// Get data for a specific URL
const postData = getMockDataByUrl('./mock-data', 'https://api.example.com/posts/1');

// Get data for specific method and URL
const userData = getMockDataByMethodAndUrl('./mock-data', 'GET', 'https://api.example.com/users/123');
```

## API Reference

### `loadMockDataForBuild(options)`

Loads and processes mock data files for build-time use.

**Options:**
- `mockDataPath` (string, required): Path to mock data directory
- `filter` (function, optional): Filter function `(filename, data) => boolean`
- `transform` (function, optional): Transform function `(data, filename) => any`
- `includeRequest` (boolean, default: true): Include request data
- `includeResponse` (boolean, default: true): Include response data
- `includeMetadata` (boolean, default: false): Include metadata (timestamp, scenario, etc.)

**Returns:**
```typescript
{
  data: any[];                    // Array of processed mock data
  byUrl: Map<string, any>;        // Map of URL to mock data
  byMethodAndUrl: Map<string, any>; // Map of method+URL to mock data
  count: number;                  // Total count
}
```

### `generateStaticDataFile(options)`

Generates a static data file from mock data.

**Options:**
- All options from `loadMockDataForBuild`
- `outputPath` (string, required): Output file path
- `format` ('json' | 'typescript' | 'javascript', default: 'json')
- `variableName` (string, default: 'mockData'): Variable name for TS/JS exports

### `generateTypesFromMockData(options)`

Generates TypeScript type definitions from mock data structure.

**Options:**
- `mockDataPath` (string, required)
- `outputPath` (string, required)
- `typeName` (string, default: 'MockDataItem')
- `filter` (function, optional)

### `preprocessMockDataForBuild(options)`

Pre-processes mock data with grouping and sorting.

**Options:**
- All options from `loadMockDataForBuild`
- `groupBy` ('endpoint' | 'method' | 'scenario' | 'session', optional)
- `sortBy` ('timestamp' | 'filename' | 'url', default: 'timestamp')
- `sortOrder` ('asc' | 'desc', default: 'desc')

## Use Cases

1. **Static Site Generation**: Pre-fetch data during build for Next.js, Gatsby, etc.
2. **Build-time Data Embedding**: Embed mock data directly into build output
3. **Type Generation**: Auto-generate TypeScript types from mock data structure
4. **Data Preprocessing**: Group, sort, and transform data before build
5. **Testing**: Use mock data in build scripts and tests

## Best Practices

1. **Filter Early**: Use `filter` to reduce the amount of data processed
2. **Transform Efficiently**: Use `transform` to extract only needed data
3. **Cache Results**: In build scripts, cache the result to avoid re-reading files
4. **Error Handling**: Always handle cases where mock data path doesn't exist
5. **Type Safety**: Use `generateTypesFromMockData` to maintain type safety

