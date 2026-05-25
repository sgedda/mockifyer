#!/usr/bin/env node
import { runMockifyerMcpServer } from './server.js';

runMockifyerMcpServer().catch((error) => {
  console.error('[mockifyer-mcp] Fatal error:', error);
  process.exit(1);
});
