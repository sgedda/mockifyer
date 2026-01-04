import express from 'express';

const router = express.Router();

// Cache of Linear issue details (in production, this would be fetched from Linear API)
const issueDetailsCache: Record<string, { description: string; title: string; url: string }> = {
  'SGE-5': {
    title: 'Create a public website for dashboard - with online storage',
    description: `## Overview

Create a public, hosted version of the Mockifyer dashboard that allows users to store and manage their mock data online. This transforms the current local CLI tool into a web-based service accessible from anywhere, with cloud storage for mock data.

## Current State

* ✅ Local CLI dashboard (\`@sgedda/mockifyer-dashboard\`)
* ✅ React frontend with shadcn/ui components
* ✅ Express backend API
* ✅ Filesystem-based storage (reads from local \`mock-data\` directory)
* ✅ All features working locally (browse, edit, delete, stats, scenarios)

## Problem

* Dashboard only works locally - requires running CLI on your machine
* Mock data stored in local filesystem - not accessible from other devices
* No multi-user support - single user, single machine
* No collaboration features - can't share mock data with team members
* No persistent access - data tied to local filesystem

## Solution

Create a public web application with online storage backend, user authentication, multi-tenancy, and public hosting. See the full issue for detailed architecture and implementation plan.`,
    url: 'https://linear.app/sgedda/issue/SGE-5/create-a-public-website-for-dashboard-with-online-storage',
  },
  'SGE-7': {
    title: 'Detox E2E Test Generation',
    description: `## Overview

Extend Mockifyer's test generation capabilities to support Detox E2E tests for React Native applications. This feature will automatically generate Detox test files when recording API requests, similar to the existing Jest/Vitest/Mocha test generation, and display generated Detox tests in the dashboard.

## Background

Mockifyer currently supports automatic test generation for:

* Jest (unit tests)
* Vitest (unit tests)
* Mocha (unit tests)

Detox is a popular E2E testing framework for React Native that allows testing real user interactions. Adding Detox support would enable developers to automatically generate E2E tests that verify API interactions in their React Native apps.

## Requirements

### 1. Core Implementation

- [ ] Add \`'detox'\` as a supported test framework in \`TestFramework\` type
- [ ] Implement \`generateDetoxTest()\` method in \`TestGenerator\` class
- [ ] Create Detox-specific test templates that:
  - Set up Detox device/emulator
  - Navigate to screens that trigger API calls
  - Verify API responses are displayed correctly in UI
  - Include proper Detox matchers and assertions
- [ ] Handle React Native-specific API patterns (fetch, axios in RN)
- [ ] Support Detox's async/await patterns and element waiting

### 2. Test Generation Logic

- [ ] Detect React Native context (check for React Native project structure)
- [ ] Generate Detox tests that:
  - Import necessary Detox utilities
  - Set up device and app launch
  - Navigate to relevant screens
  - Trigger API calls through UI interactions
  - Assert response data appears in UI components
- [ ] Group Detox tests by screen/feature (similar to endpoint grouping)
- [ ] Include proper cleanup and teardown

### 3. Configuration

- [ ] Extend \`generateTests\` config to support Detox:

  \`\`\`typescript
  generateTests: {
    enabled: true,
    framework: 'detox', // Add 'detox' option
    outputPath: './e2e/generated',
    // Detox-specific options
    detoxConfig?: {
      deviceName?: string;
      appPath?: string;
      testTimeout?: number;
      screenMapping?: Record<string, string>; // API endpoint -> screen identifier
    }
  }
  \`\`\`

### 4. Dashboard Integration

- [ ] Add Detox test status to mock file details panel
- [ ] Show "Generate Detox Test" button/action for recorded requests
- [ ] Display list of generated Detox tests in dashboard
- [ ] Add filter/view for Detox tests vs unit tests
- [ ] Show Detox test execution status (if test runner integration available)
- [ ] Display Detox test coverage metrics

### 5. React Native Integration

- [ ] Ensure test generation works with Hybrid Provider (device + project folder)
- [ ] Handle Metro bundler context for test file writing
- [ ] Support both Expo and bare React Native projects
- [ ] Generate appropriate Detox configuration references

### 6. Example Generated Test Structure

\`\`\`typescript
// e2e/generated/api/users/1.detox.test.ts
import { device, expect, element, by } from 'detox';

describe('User Profile API - GET /users/1', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should fetch and display user profile', async () => {
    // Navigate to user profile screen
    await element(by.id('user-profile-button')).tap();
    
    // Wait for API call to complete
    await waitFor(element(by.id('user-name')))
      .toBeVisible()
      .withTimeout(5000);
    
    // Verify response data is displayed
    await expect(element(by.id('user-name'))).toHaveText('John Doe');
    await expect(element(by.id('user-email'))).toHaveText('john@example.com');
  });
});
\`\`\`

## Technical Considerations

1. **Screen Mapping**: Need a way to map API endpoints to screens/components that use them
2. **Element Identification**: Generated tests need element IDs/selectors - may require manual configuration
3. **Async Handling**: Detox requires proper async/await and waitFor patterns
4. **Test Organization**: Group by screen/feature rather than just endpoint
5. **Mock Data Integration**: Ensure Detox tests use Mockifyer mocks correctly

## Related Work

* Existing test generation implementation (\`packages/mockifyer-core/src/utils/test-generator.ts\`)
* React Native test generation support (\`REACT_NATIVE_TEST_GENERATION.md\`)
* Dashboard mock file display (\`packages/mockifyer-dashboard/frontend/src/components/MockList.tsx\`)

## Success Criteria

- [ ] Detox tests can be generated automatically when recording requests in React Native apps
- [ ] Generated Detox tests are syntactically correct and runnable
- [ ] Dashboard displays Detox test information and allows test management
- [ ] Documentation includes Detox setup and usage examples
- [ ] Example React Native project demonstrates Detox test generation

## Priority

Medium - Enhances React Native developer experience and extends test generation capabilities`,
    url: 'https://linear.app/sgedda/issue/SGE-7/implement-detox-e2e-test-generation-during-request-recording-with',
  },
  'SGE-9': {
    title: 'Database provider integration',
    description: `## Overview

Enable database provider integration for Mockifyer. Currently, database providers (SQLite, Memory, Expo) exist in the codebase but are disabled and not yet available for use.

## Current Status

* ✅ Provider interface and abstraction (code exists, not yet integrated)
* ✅ Filesystem provider (currently the only supported provider)
* ⚠️ SQLite provider (code exists, but disabled - not yet available for use)
* ⚠️ Memory provider (code exists, but disabled - not yet available for use)
* ⚠️ Expo filesystem provider (code exists, but disabled - not yet available for use)

## Why This is Important

* **Performance**: SQLite offers O(log n) lookups vs O(n) for filesystem
* **React Native**: Expo filesystem provider is documented but not fully integrated
* **Scalability**: Needed for projects with 100+ mock files

## Tasks

1. Complete integration of SQLite provider into MockifyerClass
2. Enable Memory provider for testing scenarios
3. Enable Expo filesystem provider for React Native
4. Update all packages (mockifyer-axios, mockifyer-fetch) to support providers
5. Add migration utilities for existing filesystem mocks
6. Update documentation

## References

* See \`DATABASE_PROVIDER.md\` for architecture details
* Provider code exists in \`packages/mockifyer-core/src/providers/\``,
    url: 'https://linear.app/sgedda/issue/SGE-9/database-provider-integration',
  },
  'SGE-10': {
    title: 'Add caching to FilesystemProvider for performance',
    description: `## Overview

Add caching mechanism to \`FilesystemProvider\` to improve performance for projects with many mock files. Currently, \`FilesystemProvider\` reads all files from disk on every lookup, while \`ExpoFileSystemProvider\` already has a caching implementation.

## Current State

* ✅ \`ExpoFileSystemProvider\` has caching with modification time checks
* ❌ \`FilesystemProvider\` reads files sequentially on every lookup (O(n))
* No cache invalidation mechanism in \`FilesystemProvider\`

## Problem

* Every mock lookup reads all JSON files from disk
* Sequential file reads and JSON parsing on each request
* Performance degrades with more files (100+ files = 10-50ms per lookup)
* No benefit from repeated lookups to the same endpoint

## Solution

Implement caching similar to \`ExpoFileSystemProvider\`:

* Cache mock data by \`requestKey\` in a \`Map\`
* Store file modification times (\`mtime\`) for cache invalidation
* Check file modification times before returning cached results
* Clear cache entries when files are modified or deleted
* Provide manual cache clearing method

## Benefits

* **First lookup**: O(n) - reads all files (one-time cost)
* **Subsequent lookups**: O(1) - cache hit (~0.1ms)
* **Performance improvement**: 100-1000x faster for repeated lookups
* **No breaking changes**: Same API, just faster
* **Works for 100-1000+ files**: Makes filesystem provider viable for larger projects

## Reference Implementation

See \`packages/mockifyer-core/src/providers/expo-filesystem-provider.ts\` for caching pattern:

* Lines 17: \`private fileCache\` Map
* Lines 381-410: Cache check logic in \`findExactMatch()\`
* Lines 189-226: File change detection

## Tasks

1. Add cache storage (\`fileCache\` and \`fileModTimes\` Maps)
2. Implement cache check in \`findExactMatch()\` before reading files
3. Add file modification time checking for cache invalidation
4. Update \`save()\` to invalidate cache for affected keys
5. Add \`reload()\` method to clear cache (for testing/debugging)
6. Consider caching for \`findAllForSimilarMatch()\` (optional)
7. Add unit tests for cache behavior
8. Test with 100+ mock files to verify performance improvement

## Related

* See issue SGE-9 (Database provider integration) - caching makes database providers less critical for most use cases`,
    url: 'https://linear.app/sgedda/issue/SGE-10/add-caching-to-filesystemprovider-for-performance',
  },
  'SGE-11': {
    title: 'Enhanced Request Matching',
    description: `## Overview

Improve the request matching algorithms in Mockifyer to provide more flexibility and accuracy when matching incoming requests with stored mock data.

## Goals

* Enhanced algorithms for matching requests with more flexibility
* Better accuracy in request matching
* Support for more complex matching scenarios
* Improved handling of edge cases in request matching

## Benefits

* More reliable mock data matching
* Better support for complex API scenarios
* Reduced false matches
* Improved developer experience`,
    url: 'https://linear.app/sgedda/issue/SGE-11/enhanced-request-matching',
  },
  'SGE-12': {
    title: 'Mock File Versioning',
    description: `## Overview

Implement versioning for mock files to track changes over time and manage different versions of mock data.

## Goals

* Track changes to mock files over time
* Manage different versions of mock data
* View history of mock file changes
* Ability to revert to previous versions

## Benefits

* Better change tracking for mock data
* Ability to compare different versions
* Easier debugging when mocks change
* Better collaboration on mock data`,
    url: 'https://linear.app/sgedda/issue/SGE-12/mock-file-versioning',
  },
  'SGE-13': {
    title: 'GraphQL Query Normalization',
    description: `## Overview

Improve GraphQL query handling with better variable matching and query normalization.

## Goals

* Better handling of GraphQL queries
* Improved variable matching
* Query normalization for consistent matching
* Support for complex GraphQL scenarios

## Benefits

* More reliable GraphQL mock matching
* Better support for GraphQL-specific features
* Improved handling of GraphQL variables
* Enhanced GraphQL testing capabilities`,
    url: 'https://linear.app/sgedda/issue/SGE-13/graphql-query-normalization',
  },
  'SGE-14': {
    title: 'Additional Platform Support',
    description: `## Overview

Extend Mockifyer to work with more environments and frameworks beyond Node.js and React Native.

## Goals

* Support for additional platforms and frameworks
* Universal solution for API mocking across different environments
* Platform-specific optimizations
* Consistent API across all platforms

## Benefits

* Broader adoption of Mockifyer
* Support for more development environments
* Consistent mocking experience across platforms
* Future-proof architecture

## Current Focus

Currently focused on Node.js and React Native. This feature will expand support to other environments in the future.`,
    url: 'https://linear.app/sgedda/issue/SGE-14/additional-platform-support',
  },
};

// Get a specific Linear issue by ID
router.get('/:linearId', async (req: express.Request, res: express.Response) => {
  try {
    const { linearId } = req.params;
    
    const issue = issueDetailsCache[linearId];
    if (!issue) {
      return res.status(404).json({ 
        error: 'Issue not found',
        description: 'Issue details not available. Please check Linear directly.',
      });
    }
    
    res.json({
      linearId,
      title: issue.title,
      description: issue.description,
      url: issue.url,
    });
  } catch (error: any) {
    console.error('[LinearFeatures] GET Error:', error);
    res.status(500).json({ error: 'Failed to load issue', details: error.message });
  }
});

// Get features from Linear
router.get('/', async (req: express.Request, res: express.Response) => {
  try {
    // This endpoint would ideally use Linear API directly
    // For now, we'll return a static list that matches Linear issues
    // In production, you'd fetch from Linear API here
    
    const features = [
      {
        id: 'enhanced-matching',
        title: 'Enhanced Request Matching',
        description: 'Improved algorithms for matching requests with more flexibility and accuracy',
        icon: '🔮',
        linearId: 'SGE-11',
        linearUrl: 'https://linear.app/sgedda/issue/SGE-11/enhanced-request-matching',
      },
      {
        id: 'mock-versioning',
        title: 'Mock File Versioning',
        description: 'Track changes to mock files over time and manage different versions of your mock data',
        icon: '📚',
        linearId: 'SGE-12',
        linearUrl: 'https://linear.app/sgedda/issue/SGE-12/mock-file-versioning',
      },
      {
        id: 'graphql-normalization',
        title: 'GraphQL Query Normalization',
        description: 'Better handling of GraphQL queries with improved variable matching and query normalization',
        icon: '🔍',
        linearId: 'SGE-13',
        linearUrl: 'https://linear.app/sgedda/issue/SGE-13/graphql-query-normalization',
      },
      {
        id: 'platform-support',
        title: 'Additional Platform Support',
        description: 'Extend Mockifyer to work with more environments and frameworks beyond Node.js and React Native',
        icon: '🌐',
        linearId: 'SGE-14',
        linearUrl: 'https://linear.app/sgedda/issue/SGE-14/additional-platform-support',
      },
      {
        id: 'sge-5',
        title: 'Public Website for Dashboard with Online Storage',
        description: 'Create a public, hosted version of the Mockifyer dashboard that allows users to store and manage their mock data online',
        icon: '🌍',
        linearId: 'SGE-5',
        linearUrl: 'https://linear.app/sgedda/issue/SGE-5/create-a-public-website-for-dashboard-with-online-storage',
      },
      {
        id: 'sge-10',
        title: 'Add Caching to FilesystemProvider',
        description: 'Add caching mechanism to FilesystemProvider to improve performance for projects with many mock files',
        icon: '⚡',
        linearId: 'SGE-10',
        linearUrl: 'https://linear.app/sgedda/issue/SGE-10/add-caching-to-filesystemprovider-for-performance',
      },
      {
        id: 'sge-9',
        title: 'Database Provider Integration',
        description: 'Enable database provider integration for Mockifyer (SQLite, Memory, Expo providers)',
        icon: '🗄️',
        linearId: 'SGE-9',
        linearUrl: 'https://linear.app/sgedda/issue/SGE-9/database-provider-integration',
      },
      {
        id: 'sge-7',
        title: 'Detox E2E Test Generation',
        description: 'Extend Mockifyer\'s test generation capabilities to support Detox E2E tests for React Native applications',
        icon: '🧪',
        linearId: 'SGE-7',
        linearUrl: 'https://linear.app/sgedda/issue/SGE-7/implement-detox-e2e-test-generation-during-request-recording-with',
        tags: ['react native'],
      },
    ];

    res.json(features);
  } catch (error: any) {
    console.error('[LinearFeatures] GET Error:', error);
    res.status(500).json({ error: 'Failed to load features', details: error.message });
  }
});

export { router as linearFeaturesRouter };

