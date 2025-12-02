#!/usr/bin/env ts-node

/**
 * Mockifyer Bundle Generator CLI
 * 
 * Generates a TypeScript/JavaScript/JSON bundle from recorded mock data files
 * 
 * Usage:
 *   mockifyer generate-bundle [options]
 *   or: npx @sgedda/mockifyer-core generate-bundle [options]
 *   or: ts-node src/cli/generate-bundle.ts [options]
 */

import { generateStaticDataFile } from '../utils/build-utils';
import { MockData } from '../types';
import path from 'path';
import fs from 'fs';

interface CliOptions {
  input?: string;
  output?: string;
  format?: 'json' | 'typescript' | 'javascript';
  variableName?: string;
  help?: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--input' || arg === '-i') {
      options.input = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--format' || arg === '-f') {
      options.format = args[++i] as 'json' | 'typescript' | 'javascript';
    } else if (arg === '--variable-name' || arg === '-v') {
      options.variableName = args[++i];
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Mockifyer Bundle Generator

Usage:
  mockifyer generate-bundle [options]

Options:
  -i, --input <path>          Path to mock data directory (default: ./mock-data)
  -o, --output <path>          Output file path (default: ./assets/mock-data.ts)
  -f, --format <format>        Output format: json, typescript, javascript (default: typescript)
  -v, --variable-name <name>   Variable name for exported data (default: mockData)
  -h, --help                   Show this help message

Examples:
  # Generate TypeScript bundle with defaults
  mockifyer generate-bundle

  # Generate JSON bundle
  mockifyer generate-bundle --format json --output ./dist/mocks.json

  # Custom input/output paths
  mockifyer generate-bundle --input ./recorded-mocks --output ./src/mock-data.ts
`);
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Default values
  const inputPath = options.input || path.join(process.cwd(), 'mock-data');
  const outputPath = options.output || path.join(process.cwd(), 'assets', 'mock-data.ts');
  const format = options.format || 'typescript';
  const variableName = options.variableName || 'mockData';

  console.log('🔧 Mockifyer Bundle Generator\n');
  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Format: ${format}\n`);

  // Check if input directory exists
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Error: Mock data directory not found: ${inputPath}`);
    console.error('\nMake sure to:');
    console.error('  1. Record mocks during development');
    console.error('  2. Ensure mock data files are in the specified directory');
    console.error('  3. Run this command again\n');
    process.exit(1);
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`✅ Created output directory: ${outputDir}\n`);
  }

  try {
    // Generate static data file
    generateStaticDataFile({
      mockDataPath: inputPath,
      outputPath,
      format,
      variableName,
      filter: (filename, data) => {
        // Include all mocks by default
        // Users can customize this by modifying the script
        return true;
      },
      transform: (data: MockData) => {
        // Transform to clean MockData format
        // Cast to any to access potentially existing extra properties from JSON files
        const dataAny = data as any;
        const result: any = {
          request: data.request,
          response: data.response,
          timestamp: data.timestamp,
        };
        
        // Include optional scenario if present
        if (data.scenario) {
          result.scenario = data.scenario;
        }
        
        // Include additional metadata if present (for backward compatibility)
        // These are not part of the MockData type but may exist in old files
        if (dataAny.sessionId !== undefined) result.sessionId = dataAny.sessionId;
        if (dataAny.requestId !== undefined) result.requestId = dataAny.requestId;
        if (dataAny.parentRequestId !== undefined) result.parentRequestId = dataAny.parentRequestId;
        if (dataAny.source !== undefined) result.source = dataAny.source;
        if (dataAny.callStack !== undefined) result.callStack = dataAny.callStack;
        if (dataAny.duration !== undefined) result.duration = dataAny.duration;
        if (dataAny.responseTime !== undefined) result.responseTime = dataAny.responseTime;
        
        return result;
      }
    });

    console.log('✅ Successfully generated bundle file\n');
  } catch (error: any) {
    console.error('❌ Error generating bundle:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  - Check that mock-data directory contains valid JSON files');
    console.error('  - Verify file permissions');
    console.error('  - Check error details above\n');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as generateBundle };

