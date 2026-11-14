#!/usr/bin/env node

/**
 * Mockifyer Init CLI
 * 
 * Detects your HTTP client (axios, fetch, or React Native) and writes a minimal
 * config with selective recording defaults. Prints setup instructions.
 * 
 * Usage:
 *   npx mockifyer init [options]
 */

import fs from 'fs';
import path from 'path';

interface ParsedArgs {
  force: boolean;
  help: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const parsed: ParsedArgs = {
    force: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--force' || arg === '-f') {
      parsed.force = true;
    }
  }

  return parsed;
}

function showHelp() {
  const help = `
Mockifyer Init - Zero-config onboarding

USAGE
  npx mockifyer init [options]

DESCRIPTION
  Detects fetch, axios, or React Native from package.json and writes a minimal
  mockifyer.config.json with selective recording defaults (request-only stubs
  into _scratch, activate mocks via dashboard or domain-path rules).

  Prints the 2-3 setup lines for your HTTP client (or inserts them safely when
  possible). Never overwrites an existing config without --force.

OPTIONS
  -f, --force    Overwrite existing mockifyer.config.json
  -h, --help     Show this help

NEXT STEPS
  After init:
    1. npx mockifyer try              (self-contained demo)
    2. npx mockifyer-dashboard        (browse/activate mocks)

EXAMPLES
  # Zero-config setup
  npx mockifyer init

  # Force overwrite existing config
  npx mockifyer init --force
`;
  console.log(help);
}

type ClientType = 'axios' | 'fetch' | 'react-native' | 'unknown';

interface DetectionResult {
  clientType: ClientType;
  hasAxios: boolean;
  hasFetch: boolean;
  isReactNative: boolean;
}

function detectHttpClient(cwd: string): DetectionResult {
  const pkgPath = path.join(cwd, 'package.json');
  
  if (!fs.existsSync(pkgPath)) {
    return {
      clientType: 'unknown',
      hasAxios: false,
      hasFetch: false,
      isReactNative: false,
    };
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  const hasAxios = 'axios' in allDeps;
  const isReactNative = 'react-native' in allDeps;
  const hasFetch = !hasAxios && !isReactNative;

  let clientType: ClientType;
  if (isReactNative) {
    clientType = 'react-native';
  } else if (hasAxios) {
    clientType = 'axios';
  } else if (hasFetch) {
    clientType = 'fetch';
  } else {
    clientType = 'unknown';
  }

  return { clientType, hasAxios, hasFetch, isReactNative };
}

function findNearestPackageJson(startDir: string): string {
  let currentDir = startDir;
  while (true) {
    const pkgPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return startDir;
    }
    currentDir = parentDir;
  }
}

function writeMinimalConfig(targetPath: string, clientType: ClientType) {
  const config = {
    mockDataPath: './mock-data',
    recordMode: true,
    recordNewMocksAsPassthrough: true,
    recordResponses: false,
  };

  fs.writeFileSync(targetPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

function getSetupInstructions(clientType: ClientType): string[] {
  switch (clientType) {
    case 'axios':
      return [
        "import { setupMockifyer } from '@sgedda/mockifyer-axios';",
        '',
        "setupMockifyer({",
        "  mockDataPath: './mock-data',",
        "  recordMode: true,",
        "  recordNewMocksAsPassthrough: true,  // Selective: activate in dashboard",
        "  recordResponses: false,             // Request-only stubs initially",
        "});",
      ];
    case 'fetch':
      return [
        "import { setupMockifyer } from '@sgedda/mockifyer-fetch';",
        '',
        "setupMockifyer({",
        "  mockDataPath: './mock-data',",
        "  recordMode: true,",
        "  recordNewMocksAsPassthrough: true,  // Selective: activate in dashboard",
        "  recordResponses: false,             // Request-only stubs initially",
        "  useGlobalFetch: true,",
        "});",
      ];
    case 'react-native':
      return [
        "import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch';",
        '',
        "setupMockifyerForReactNative({",
        "  mockDataPath: './mock-data',",
        "  runtimeMode: 'on',",
        "  recordNewMocksAsPassthrough: true,  // Selective: activate in dashboard",
        "  recordResponses: false,             // Request-only stubs initially",
        "});",
      ];
    default:
      return [
        "// Install @sgedda/mockifyer-axios or @sgedda/mockifyer-fetch first",
        "// Then run 'npx mockifyer init' again to detect your client",
      ];
  }
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

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  const cwd = process.cwd();
  const projectRoot = findNearestPackageJson(cwd);
  const configPath = path.join(projectRoot, 'mockifyer.config.json');

  const detection = detectHttpClient(projectRoot);

  console.log('');
  console.log(bold('Mockifyer Init'));
  console.log('');

  if (fs.existsSync(configPath) && !args.force) {
    console.log(green('✓') + ' mockifyer.config.json already exists');
    console.log('');
    console.log('  Use --force to overwrite, or edit the existing config.');
    console.log('');
    console.log(dim('Next steps:'));
    console.log('  npx mockifyer try');
    console.log('  npx mockifyer dashboard');
    console.log('');
    process.exit(0);
  }

  console.log('Detected: ' + bold(detection.clientType));
  console.log('');

  writeMinimalConfig(configPath, detection.clientType);

  console.log(green('✓') + ' Created mockifyer.config.json');
  console.log('');

  const setupLines = getSetupInstructions(detection.clientType);
  
  console.log(bold('Setup (add to your entry file):'));
  console.log('');
  for (const line of setupLines) {
    console.log('  ' + line);
  }
  console.log('');

  console.log(dim('What just happened?'));
  console.log('  • Selective recording: requests land in ' + bold('_scratch/') + ' as request-only stubs');
  console.log('  • Mocks stay on the live API until you activate them in the dashboard');
  console.log('  • No responses recorded yet (activate via dashboard or domain-path rules)');
  console.log('');

  console.log(dim('Next steps:'));
  console.log('  ' + bold('npx mockifyer try') + '              (self-contained demo)');
  console.log('  ' + bold('npx mockifyer-dashboard') + '        (browse/activate mocks)');
  console.log('');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
}

export { main };
