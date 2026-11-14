#!/usr/bin/env node

/**
 * Mockifyer Try CLI - Core-only version
 * 
 * Self-contained demo using only @sgedda/mockifyer-core (no fetch/axios dependencies).
 * Uses Node's http module with core's FilesystemProvider directly.
 */

import http from 'http';
import path from 'path';
import fs from 'fs';
import { FilesystemProvider } from '../providers/filesystem-provider';
import { generateRequestKey } from '../utils/mock-matcher';
import type { MockData, StoredRequest } from '../types';

interface ParsedArgs {
  keep: boolean;
  help: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const parsed: ParsedArgs = {
    keep: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--keep' || arg === '-k') {
      parsed.keep = true;
    }
  }

  return parsed;
}

function showHelp() {
  const help = `
Mockifyer Try - Self-contained demo

USAGE
  npx mockifyer try [options]

DESCRIPTION
  Demonstrates record/replay without touching your real API:
  
  1. Starts a tiny local HTTP server
  2. Makes one GET request and records it into _scratch
  3. Stops the server
  4. Replays the request from the mock (0 network calls)
  
  Takes ~10 seconds. Cleans up temporary files unless --keep.

OPTIONS
  -k, --keep     Keep temporary files (mock data, test server code)
  -h, --help     Show this help

NEXT STEPS
  After seeing the demo:
    1. Add setupMockifyer to your app (see 'npx mockifyer init')
    2. Run your app normally (requests land in _scratch/)
    3. Open the dashboard to activate mocks: npx mockifyer-dashboard

EXAMPLES
  # Run the demo
  npx mockifyer try

  # Keep artifacts for inspection
  npx mockifyer try --keep
`;
  console.log(help);
}

function green(text: string): string {
  return process.stdout.isTTY ? `\x1b[32m${text}\x1b[0m` : text;
}

function dim(text: string): string {
  return process.stdout.isTTY ? `\x1b[2m${text}\x1b[0m` : text;
}

function bold(text: string): string {
  return process.stdout.isTTY ? `\x1b[1m${text}\x1b[0m` : text;
}

function yellow(text: string): string {
  return process.stdout.isTTY ? `\x1b[33m${text}\x1b[0m` : text;
}

interface HttpServer {
  server: http.Server;
  port: number;
}

function startTestServer(): Promise<HttpServer> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/hello' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Hello from Mockifyer!', timestamp: new Date().toISOString() }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(0, 'localhost', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 3999;
      resolve({ server, port });
    });
  });
}

function stopServer(httpServer: HttpServer): Promise<void> {
  return new Promise((resolve) => {
    httpServer.server.close(() => resolve());
  });
}

function makeHttpRequest(url: string): Promise<{ body: any; status: number }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ body: json, status: res.statusCode || 200 });
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

async function runDemo(keep: boolean) {
  console.log('');
  console.log(bold('Mockifyer Try - Self-contained demo'));
  console.log('');

  const tmpDir = path.join(process.cwd(), '.mockifyer-try-demo');
  const mockDataPath = path.join(tmpDir, 'mock-data');

  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });

  console.log(dim('Step 1: Starting test server...'));
  const httpServer = await startTestServer();
  const testUrl = `http://localhost:${httpServer.port}/hello`;
  console.log(green('✓') + ` Test server running on port ${httpServer.port}`);
  console.log('');

  console.log(dim('Step 2: Recording request...'));

  // Initialize provider for recording
  const recordProvider = new FilesystemProvider({
    path: mockDataPath,
    options: {},
  });
  recordProvider.initialize();

  // Make request and record
  let recordResult: any;
  try {
    recordResult = await makeHttpRequest(testUrl);
    
    // Save as mock
    const mockData: MockData = {
      request: {
        method: 'GET',
        url: testUrl,
        headers: {},
      },
      response: {
        status: recordResult.status,
        data: recordResult.body,
        headers: { 'content-type': 'application/json' },
      },
      timestamp: new Date().toISOString(),
    };
    
    recordProvider.save(mockData, { scenario: '_scratch' });
  } catch (error: any) {
    console.error('Failed to record:', error.message);
    await stopServer(httpServer);
    if (!keep) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    process.exit(1);
  }

  console.log(green('✓') + ' Recorded: GET ' + testUrl);
  console.log('  Response: ' + JSON.stringify(recordResult.body));
  console.log('');

  const scratchDir = path.join(mockDataPath, '_scratch');
  const mockFiles = fs.existsSync(scratchDir)
    ? fs.readdirSync(scratchDir, { recursive: true })
        .filter((f) => typeof f === 'string' && f.endsWith('.json'))
    : [];
  const mockFilePath = mockFiles.length > 0 
    ? path.join(scratchDir, mockFiles[0] as string)
    : null;

  if (mockFilePath) {
    console.log(dim('Mock saved: ' + path.relative(process.cwd(), mockFilePath)));
    console.log('');
  }

  console.log(dim('Step 3: Stopping server...'));
  await stopServer(httpServer);
  console.log(green('✓') + ' Server stopped (network unavailable)');
  console.log('');

  console.log(dim('Step 4: Replaying from mock...'));

  // Initialize provider for replay
  const replayProvider = new FilesystemProvider({
    path: mockDataPath,
    options: {},
  });

  const request: StoredRequest = {
    method: 'GET',
    url: testUrl,
    headers: {},
  };
  const requestKey = generateRequestKey(request);
  const cached = replayProvider.findExactMatch(request, requestKey);

  if (!cached) {
    console.error('Failed to find mock for replay');
    if (!keep) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    process.exit(1);
  }

  const replayResult = cached.mockData.response;

  console.log(green('✓') + ' Replayed from mock (0 network calls)');
  console.log('  Response: ' + JSON.stringify(replayResult.data));
  console.log('');

  console.log(bold('Summary:'));
  console.log('  Recorded: GET ' + testUrl);
  console.log('  Mock file: ' + (mockFilePath ? path.relative(process.cwd(), mockFilePath) : 'unknown'));
  console.log('  Replay: ' + green('SUCCESS') + ' (server was stopped, mock served response)');
  console.log('');

  if (!keep) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    console.log(dim('Cleaned up temporary files'));
  } else {
    console.log(yellow('⚠') + ' Kept temporary files in: ' + tmpDir);
  }
  console.log('');

  console.log(dim('Next steps:'));
  console.log('  1. Add setupMockifyer to your app (see: ' + bold('npx mockifyer init') + ')');
  console.log('  2. Run your app (requests land in _scratch/)');
  console.log('  3. Activate mocks: ' + bold('npx mockifyer-dashboard'));
  console.log('');
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  try {
    await runDemo(args.keep);
  } catch (error: any) {
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}
