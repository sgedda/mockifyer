#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import open from 'open';
import { createServer } from './server';
import { detectMockDataPath, detectProvider } from './utils/path-detector';
import path from 'path';
import fs from 'fs';

const program = new Command();

program
  .name('mockifyer-dashboard')
  .description('Standalone dashboard for viewing and managing Mockifyer mock data')
  .version('1.0.0')
  .option('-p, --path <path>', 'Path to mock data directory or SQLite database file')
  .option('--port <port>', 'Port to run the dashboard on', '3002')
  .option('--host <host>', 'Host to bind to', 'localhost')
  .option('--no-open', 'Do not open browser automatically')
  .option('--provider <provider>', 'Database provider type (filesystem, sqlite, redis)', 'filesystem')
  .option('--redis-url <url>', 'Redis URL (or use MOCKIFYER_REDIS_URL env var)')
  .option(
    '--key-prefix <prefix>',
    'Redis key prefix (or use MOCKIFYER_REDIS_KEY_PREFIX env var; default: mockifyer:v1)'
  )
  .parse(process.argv);

const options = program.opts();

async function main() {
  try {
    // Detect mock data path
    const mockDataPath = detectMockDataPath(options.path);
    const provider = options.provider || detectProvider(mockDataPath);
    const redisUrl = options.redisUrl || process.env.MOCKIFYER_REDIS_URL;
    const keyPrefix = options.keyPrefix || process.env.MOCKIFYER_REDIS_KEY_PREFIX;
    
    // Debug: Log detected path
    if (process.env.DEBUG) {
      console.log(chalk.gray(`\n🔍 Debug: Detected mock data path: ${mockDataPath}`));
      console.log(chalk.gray(`🔍 Debug: Current working directory: ${process.cwd()}`));
      console.log(chalk.gray(`🔍 Debug: Path exists: ${fs.existsSync(mockDataPath)}\n`));
    }

    const validProviders = new Set(['filesystem', 'sqlite', 'redis']);
    if (!validProviders.has(provider)) {
      console.error(chalk.red(`\n❌ Error: Unsupported database provider '${provider}'.`));
      console.error(chalk.yellow("Supported providers: filesystem, sqlite, redis.\n"));
      process.exit(1);
    }

    // Check if path exists (or create default directory)
    if (provider !== 'redis' && !fs.existsSync(mockDataPath)) {
      console.log(chalk.yellow(`\n⚠️  Mock data path does not exist: ${mockDataPath}`));
      console.log(chalk.cyan('Creating directory...'));
      fs.mkdirSync(mockDataPath, { recursive: true });
      console.log(chalk.green('✓ Directory created\n'));
    }

    // Get public directory (where frontend files are)
    // When running with ts-node, __dirname points to src/, when compiled it points to dist/
    const publicDir = path.join(__dirname, '..', 'public');
    
    if (!fs.existsSync(publicDir)) {
      console.error(chalk.red(`\n❌ Error: Public directory not found: ${publicDir}`));
      console.error(chalk.yellow('Please ensure the package is built correctly.\n'));
      process.exit(1);
    }

    // Create and start server
    const app = createServer(publicDir, mockDataPath, {
      provider,
      redisUrl,
      keyPrefix,
    });
    const port = parseInt(options.port, 10);
    const host = options.host;

    const server = app.listen(port, host, () => {
      const url = `http://${host}:${port}`;
      
      console.log(chalk.green('\n✨ Mockifyer Dashboard is running!\n'));
      console.log(chalk.cyan(`   📊 Dashboard: ${chalk.bold(url)}`));
      console.log(chalk.cyan(`   📁 Mock Data: ${chalk.bold(mockDataPath)}`));
      console.log(chalk.cyan(`   🔧 Provider: ${chalk.bold(provider)}\n`));
      if (provider === 'redis') {
        console.log(
          chalk.cyan(`   🧠 Redis URL: ${chalk.bold(redisUrl || 'redis://127.0.0.1:6379 (default)')}`)
        );
        console.log(
          chalk.cyan(`   🏷️  Key Prefix: ${chalk.bold(keyPrefix || 'mockifyer:v1 (default)')}\n`)
        );
      }
      
      if (!options.noOpen) {
        open(url).catch(() => {
          console.log(chalk.yellow(`   ⚠️  Could not open browser automatically. Please visit ${url}`));
        });
      }
      
      console.log(chalk.gray('   Press Ctrl+C to stop\n'));
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\n👋 Shutting down dashboard...'));
      server.close(() => {
        console.log(chalk.green('✓ Dashboard stopped\n'));
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      server.close(() => {
        process.exit(0);
      });
    });

  } catch (error: any) {
    console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }
}

main();

