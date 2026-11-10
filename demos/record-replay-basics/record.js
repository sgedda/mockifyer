// Record script - captures real API responses with Mockifyer
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

// Make recorded mocks immediately replayable
process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API = 'false';
process.env.MOCKIFYER_RECORD_RESPONSES = 'true';

setupMockifyer({
  mockDataPath: './mock-data',
  defaultScenario: 'default',
  recordMode: true,
  useGlobalFetch: true,
  domainPathRulesMode: 'record_all',
});

async function record() {
  console.log('📝 Recording responses from demo.devxtools.dev...\n');
  
  // Record /tasks endpoint
  console.log('GET /tasks');
  const tasksRes = await fetch('https://demo.devxtools.dev/tasks');
  const tasks = await tasksRes.json();
  console.log(`✓ Recorded ${tasks.length} tasks\n`);
  
  // Record /tasks/1 endpoint
  console.log('GET /tasks/1');
  const taskRes = await fetch('https://demo.devxtools.dev/tasks/1');
  const task = await taskRes.json();
  console.log(`✓ Recorded task: "${task.title}"\n`);
  
  // Record /users endpoint
  console.log('GET /users');
  const usersRes = await fetch('https://demo.devxtools.dev/users');
  const users = await usersRes.json();
  console.log(`✓ Recorded ${users.length} users\n`);
  
  console.log('✅ All mocks saved to mock-data/default/');
  console.log('Run `npm test` to replay them offline!');
}

record().catch(console.error);
