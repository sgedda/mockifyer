import { FullConfig } from '@playwright/test';
import { generateAtlasReport } from './lib/atlas-report';

/**
 * Global teardown: Generate Atlas documentation from captured network events
 */
async function globalTeardown(_config: FullConfig) {
  console.log('\n=== E2E Global Teardown ===\n');

  try {
    console.log('Generating Atlas documentation from e2e network events...');
    const result = await generateAtlasReport();
    console.log(`  ✓ Fetched and scrubbed ${result.eventCount} network events`);
    console.log(`  ✓ Scanned ${result.endpointCount} endpoints`);
    console.log(`  ✓ Atlas HTML generated\n`);
    console.log(`  📄 ${result.indexPath}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`\n⚠ Atlas teardown warning: ${message}`);
    console.warn('Continuing without Atlas report (tests are not affected)\n');
    // Never fail tests due to Atlas generation
  }

  console.log('=== Teardown Complete ===\n');
}

export default globalTeardown;
