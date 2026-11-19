// Unit tests for getDashboardUrl function
// Run with: node dashboard-url.test.js

function getDashboardUrl(hostname) {
  // StackBlitz WebContainer: *.webcontainer.io
  // Real pattern: bnmiqabookgithub-0eb2--5173--0df13572.local-credentialless.webcontainer.io
  // Port is between double dashes: --5173-- → --3002--
  if (hostname.includes('.webcontainer.io')) {
    // Replace --PORT-- with --3002--
    if (hostname.includes('--')) {
      const dashboardHost = hostname.replace(/--\d+--/, '--3002--');
      return `https://${dashboardHost}`;
    }
    // Fallback for older pattern: project-5173.webcontainer.io
    const dashboardHost = hostname.replace(/-\d+\.webcontainer\.io/, '-3002.webcontainer.io');
    return `https://${dashboardHost}`;
  }
  
  // Other cloud IDEs
  if (hostname.includes('stackblitz') || hostname.includes('gitpod') || hostname.includes('codespaces')) {
    return `https://${hostname.replace(/:\d+/, '')}:3002`;
  }
  
  // Local development
  return 'http://localhost:3002';
}

// Test cases
const tests = [
  {
    name: 'Real StackBlitz hostname (Sebastian\'s actual)',
    hostname: 'bnmiqabookgithub-0eb2--5173--0df13572.local-credentialless.webcontainer.io',
    expected: 'https://bnmiqabookgithub-0eb2--3002--0df13572.local-credentialless.webcontainer.io'
  },
  {
    name: 'StackBlitz with different port',
    hostname: 'myproject-abc123--8080--xyz789.webcontainer.io',
    expected: 'https://myproject-abc123--3002--xyz789.webcontainer.io'
  },
  {
    name: 'Legacy StackBlitz pattern (fallback)',
    hostname: 'project-5173.webcontainer.io',
    expected: 'https://project-3002.webcontainer.io'
  },
  {
    name: 'Localhost',
    hostname: 'localhost',
    expected: 'http://localhost:3002'
  },
  {
    name: 'Localhost with port',
    hostname: 'localhost:5173',
    expected: 'http://localhost:3002'
  }
];

let passed = 0;
let failed = 0;

console.log('Running getDashboardUrl tests...\n');

tests.forEach(test => {
  const result = getDashboardUrl(test.hostname);
  const success = result === test.expected;
  
  if (success) {
    console.log(`✓ ${test.name}`);
    console.log(`  ${test.hostname}`);
    console.log(`  → ${result}\n`);
    passed++;
  } else {
    console.log(`✗ ${test.name}`);
    console.log(`  ${test.hostname}`);
    console.log(`  Expected: ${test.expected}`);
    console.log(`  Got:      ${result}\n`);
    failed++;
  }
});

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
