// Re-record script to update stale mocks
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API = 'false';
process.env.MOCKIFYER_RECORD_RESPONSES = 'true';

setupMockifyer({
  mockDataPath: './mock-data',
  defaultScenario: 'updated',
  recordMode: true,
  useGlobalFetch: true,
  domainPathRulesMode: 'record_all',
});

async function record() {
  console.log('🔄 Re-recording response from demo.devxtools.dev/tasks\n');
  
  const response = await fetch('https://demo.devxtools.dev/tasks');
  const data = await response.json();
  
  console.log(`✓ Recorded ${data.length} tasks\n`);
  console.log('💡 Now run `git diff mock-data/` to see what changed!');
}

record().catch(console.error);
