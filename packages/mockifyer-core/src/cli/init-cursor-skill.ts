#!/usr/bin/env ts-node

/**
 * Install the Mockifyer Cursor skill into the current project.
 *
 * Usage:
 *   npx mockifyer-init-cursor
 *   npx mockifyer-init-cursor --force
 */

import fs from 'fs';
import path from 'path';

const SKILL_DIR_NAME = 'mockifyer';
const SKILL_FILES = ['SKILL.md', 'reference.md'] as const;

interface CliOptions {
  target?: string;
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
Mockifyer Cursor skill installer

Copies the Mockifyer agent skill into .cursor/skills/mockifyer/ so Cursor
can help with setupMockifyer, mock-data, scenarios, and GraphQL matching.

Usage:
  npx mockifyer-init-cursor [options]

Options:
  -t, --target <dir>   Project root (default: current working directory)
  -f, --force          Overwrite existing skill files
      --dry-run        Print actions without writing files
  -h, --help           Show this help message

Examples:
  npx mockifyer-init-cursor
  npx mockifyer-init-cursor --force
`);
}

function getSkillsSourceDir(): string {
  return path.join(__dirname, '../../skills', SKILL_DIR_NAME);
}

function copySkillFiles(sourceDir: string, destDir: string, options: CliOptions): void {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Skill source not found: ${sourceDir}`);
  }

  for (const file of SKILL_FILES) {
    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(destDir, file);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing skill file: ${sourcePath}`);
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
  const destDir = path.join(projectRoot, '.cursor', 'skills', SKILL_DIR_NAME);
  const sourceDir = getSkillsSourceDir();

  console.log(`Installing Mockifyer Cursor skill into ${destDir}`);

  copySkillFiles(sourceDir, destDir, options);

  if (!options.dryRun) {
    console.log('\nDone. Cursor will use this skill when working in this project.');
    console.log('Docs: https://mockifyer.dev/llms.txt');
  }
}

try {
  main();
} catch (error) {
  console.error(`[mockifyer-init-cursor] ${(error as Error).message}`);
  process.exit(1);
}
