# Database Provider Architecture

⚠️ **NOT YET AVAILABLE FOR USE** ⚠️

Database providers (SQLite, Memory, Expo) are **not yet available for use**. Only the filesystem provider is currently supported.

This documentation exists for **future reference** when database providers become available. The code exists in the codebase but is disabled and will throw an error if you try to use non-filesystem providers.

---

Mockifyer will support pluggable database providers for storing and retrieving mock data. This will allow you to choose between filesystem storage (default) or SQLite database.

## Why SQLite?

SQLite is recommended as the primary database option because:

- **Zero configuration**: File-based, similar to JSON files
- **Fast lookups**: Indexed queries for better performance
- **JSON support**: Built-in JSON1 extension for JSON operations
- **Easy migration**: Can easily switch to PostgreSQL later if needed
- **Perfect for local dev**: No server setup required
- **Production ready**: Used by many production applications

## Architecture

### Provider Interface

All providers implement the `DatabaseProvider` interface:

```typescript
interface DatabaseProvider {
  initialize(): void;
  save(mockData: MockData): void;
  findExactMatch(request: StoredRequest, requestKey: string): CachedMockData | undefined;
  findAllForSimilarMatch(request: StoredRequest): CachedMockData[];
  exists(requestKey: string): boolean;
  getAll(): MockData[];
  close?(): void;
}
```

### Available Providers

1. **FilesystemProvider** (default)
   - Stores mock data as JSON files
   - Compatible with existing mockifyer installations
   - Good for small projects

2. **SQLiteProvider**
   - Stores mock data in SQLite database
   - Faster lookups with indexed queries
   - Better for larger projects with many mocks

## Usage

### Using Filesystem Provider (Default)

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-axios';

setupMockifyer({
  mockDataPath: './mock-data',
  // No databaseProvider config = uses filesystem (default)
});
```

### Using SQLite Provider (NOT YET AVAILABLE)

⚠️ **This feature is not yet available.** Attempting to use SQLite provider will result in an error.

```typescript
// ⚠️ THIS WILL THROW AN ERROR - NOT YET AVAILABLE
import { setupMockifyer } from '@sgedda/mockifyer-axios';

setupMockifyer({
  mockDataPath: './mock-data', // Still used for backward compatibility
  databaseProvider: {
    type: 'sqlite', // ❌ This will throw: "Database provider type 'sqlite' is not yet available for use"
    path: './mock-data.db', // SQLite database file path
  },
});
```

### Environment Variables

You can also configure via environment variables:

```bash
# Use SQLite provider
MOCKIFYER_DB_PROVIDER=sqlite
MOCKIFYER_DB_PATH=./mock-data.db

# Use filesystem provider (default)
MOCKIFYER_DB_PROVIDER=filesystem
MOCKIFYER_DB_PATH=./mock-data
```

## Installation

For SQLite provider, install `better-sqlite3`:

```bash
npm install better-sqlite3
```

The filesystem provider requires no additional dependencies.

## Migration

### From Filesystem to SQLite

1. Install `better-sqlite3`:
   ```bash
   npm install better-sqlite3
   ```

2. Update your config:
   ```typescript
   setupMockifyer({
     mockDataPath: './mock-data',
     databaseProvider: {
       type: 'sqlite',
       path: './mock-data.db',
     },
   });
   ```

3. Existing JSON files will continue to work, but new mocks will be saved to SQLite.

### Migrating Existing JSON Files to SQLite

You can write a migration script to import existing JSON files:

```typescript
import { SQLiteProvider } from '@sgedda/mockifyer-core';
import fs from 'fs';
import path from 'path';

const provider = new SQLiteProvider({ path: './mock-data.db' });
provider.initialize();

const jsonFiles = fs.readdirSync('./mock-data')
  .filter(f => f.endsWith('.json'));

for (const file of jsonFiles) {
  const content = JSON.parse(fs.readFileSync(path.join('./mock-data', file), 'utf-8'));
  provider.save(content);
}

provider.close();
```

## Performance Comparison

- **Filesystem**: O(n) - reads all files sequentially
- **SQLite**: O(log n) - indexed lookups, much faster for large datasets

For projects with 100+ mock files, SQLite provides significant performance improvements.

## Future Providers

The architecture supports adding more providers:

- **PostgreSQL**: For production deployments
- **MongoDB**: Document store alternative
- **Redis**: For caching scenarios

## Implementation Status

✅ Provider interface and abstraction (code exists, not yet integrated)
✅ Filesystem provider (currently the only supported provider)
⚠️ SQLite provider (code exists, but disabled - not yet available for use)
⚠️ Memory provider (code exists, but disabled - not yet available for use)
⚠️ Expo filesystem provider (code exists, but disabled - not yet available for use)

**Current Status:** Only the filesystem provider is available. All other providers will throw an error if attempted to use. The code exists for future use but is not yet integrated into the main setupMockifyer flow.
✅ Configuration support
⏳ Integration into MockifyerClass (in progress)
⏳ Update all packages (mockifyer-axios, mockifyer-fetch)


