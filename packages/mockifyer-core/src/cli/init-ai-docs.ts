#!/usr/bin/env ts-node

/**
 * Install Mockifyer AI assistant docs into the current project.
 *
 * Usage:
 *   npx mockifyer-init-ai
 *   npx mockifyer-init-ai --force
 */

import fs from 'fs';
import path from 'path';

const DOCS_SUBDIR = path.join('docs', 'mockifyer-ai');
const DOC_FILES = ['INSTRUCTIONS.md', 'reference.md'] as const;

interface CliOptions {
  target?: string;
  dest?: string;
  force?: boolean;
  dryRun?: boolean;
  help?: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--target' || arg === '-t') {
      options.target = args[++i];
    } else if (arg === '--dest' || arg === '-d') {
      options.dest = args[++i];
    } else if (arg === '--force' || arg === '-f') {
      options.force = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

function showHelp(): void {
  console.log(`
Mockifyer AI docs installer

Copies editor-agnostic Mockifyer guidance into docs/mockifyer-ai/ so any AI
assistant (Copilot, Cursor, Claude, etc.) can be pointed at setupMockifyer,
mock-data, scenarios, and GraphQL matching.

Usage:
  npx mockifyer-init-ai [options]

Options:
  -t, --target <dir>   Project root (default: current working directory)
  -d, --dest <path>    Output directory relative to project root
                       (default: docs/mockifyer-ai)
  -f, --force          Overwrite existing files
      --dry-run        Print actions without writing files
  -h, --help           Show this help message

Examples:
  npx mockifyer-init-ai
  npx mockifyer-init-ai --force
  npx mockifyer-init-ai --dest .github/instructions/mockifyer
`);
}

function getDocsSourceDir(): string {
  return path.join(__dirname, '../../ai/mockifyer');
}

function copyDocFiles(sourceDir: string, destDir: string, options: CliOptions): void {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Docs source not found: ${sourceDir}`);
  }

  for (const file of DOC_FILES) {
    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(destDir, file);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing doc file: ${sourcePath}`);
    }

    if (fs.existsSync(destPath) && !options.force) {
      console.log(`  skip ${destPath} (exists; use --force to overwrite)`);
      continue;
    }

    if (options.dryRun) {
      console.log(`  would copy ${sourcePath} -> ${destPath}`);
      continue;
    }

    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(sourcePath, destPath);
    console.log(`  wrote ${destPath}`);
  }
}

function main(): void {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  const projectRoot = path.resolve(options.target ?? process.cwd());
  const destDir = path.resolve(projectRoot, options.dest ?? DOCS_SUBDIR);
  const sourceDir = getDocsSourceDir();

  console.log(`Installing Mockifyer AI docs into ${destDir}`);

  copyDocFiles(sourceDir, destDir, options);

  if (!options.dryRun) {
    console.log('\nDone. Point your AI assistant at INSTRUCTIONS.md in that folder.');
    console.log('Online reference: https://mockifyer.dev/llms.txt');
  }
}

try {
  main();
} catch (error) {
  console.error(`[mockifyer-init-ai] ${(error as Error).message}`);
  process.exit(1);
}
