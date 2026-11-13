#!/usr/bin/env node

/**
 * Mockifyer Drift Check CLI
 * 
 * Detects when live API responses diverge from committed mock contracts.
 * 
 * Usage:
 *   mockifyer-drift-check [options]
 *   npx mockifyer-drift-check [options]
 */

import { checkDrift } from '../utils/drift/check-drift';
import { DriftCheckOptions } from '../utils/drift/drift-report';
import { MockDriftReport } from '../utils/drift/drift-report';
import {
  acceptDrift,
  acceptAllWarnings,
  snoozeEndpoint,
  addIgnoreField,
} from '../utils/drift/drift-management';

interface ParsedArgs {
  scenario?: string;
  mockDataPath?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
  ignorePaths?: string[];
  allowUnsafeMethods?: boolean;
  failOnWarnings?: boolean;
  concurrency?: number;
  timeoutMs?: number;
  delayMs?: number;
  noHistory?: boolean;
  accept?: string;
  acceptAllWarnings?: boolean;
  ignoreField?: { endpoint: string; path: string };
  snooze?: string;
  days?: number;
  json: boolean;
  help: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const parsed: ParsedArgs = {
    json: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--scenario' || arg === '-s') {
      parsed.scenario = args[++i];
    } else if (arg === '--mock-data-path' || arg === '-m') {
      parsed.mockDataPath = args[++i];
    } else if (arg === '--base-url' || arg === '-b') {
      parsed.baseUrl = args[++i];
    } else if (arg === '--header' || arg === '-H') {
      if (!parsed.headers) parsed.headers = {};
      const header = args[++i];
      const [key, ...valueParts] = header.split(':');
      if (key && valueParts.length > 0) {
        parsed.headers[key.trim()] = valueParts.join(':').trim();
      }
    } else if (arg === '--ignore-path' || arg === '-i') {
      if (!parsed.ignorePaths) parsed.ignorePaths = [];
      parsed.ignorePaths.push(args[++i]);
    } else if (arg === '--allow-unsafe-methods') {
      parsed.allowUnsafeMethods = true;
    } else if (arg === '--fail-on-warnings') {
      parsed.failOnWarnings = true;
    } else if (arg === '--concurrency' || arg === '-c') {
      parsed.concurrency = parseInt(args[++i], 10);
    } else if (arg === '--timeout') {
      parsed.timeoutMs = parseInt(args[++i], 10);
    } else if (arg === '--delay') {
      parsed.delayMs = parseInt(args[++i], 10);
    } else if (arg === '--no-history') {
      parsed.noHistory = true;
    } else if (arg === '--accept') {
      parsed.accept = args[++i];
    } else if (arg === '--accept-all-warnings') {
      parsed.acceptAllWarnings = true;
    } else if (arg === '--ignore-field') {
      const endpoint = args[++i];
      const path = args[++i];
      parsed.ignoreField = { endpoint, path };
    } else if (arg === '--snooze') {
      parsed.snooze = args[++i];
    } else if (arg === '--days') {
      parsed.days = parseInt(args[++i], 10);
    } else if (arg === '--json') {
      parsed.json = true;
    }
  }

  return parsed;
}

function showHelp() {
  const help = `
Mockifyer Drift Check - Detect API contract changes

USAGE
  mockifyer-drift-check [options]
  npx mockifyer-drift-check [options]

DESCRIPTION
  Compares recorded mock responses with live API responses to detect drift.
  Reports structural changes (status, keys, types) without exposing values.

OPTIONS
  -s, --scenario <name>          Scenario to check (default: "default")
  -m, --mock-data-path <path>    Path to mock data folder (default: auto-detected)
  -b, --base-url <url>           Override base URL for live requests
  -H, --header <name:value>      Add header to live requests (repeatable)
  -i, --ignore-path <path>       JSON path to ignore (e.g., "timestamp", "data.id")
      --allow-unsafe-methods     Check POST/PUT/DELETE requests (default: GET only)
      --fail-on-warnings         Exit with code 1 on warnings (default: breaking only)
  -c, --concurrency <n>          Max concurrent requests (default: 5)
      --timeout <ms>             Request timeout in milliseconds (default: 10000)
      --delay <ms>               Delay between request batches (default: 100)
      --no-history               Skip writing history (for ad-hoc checks)
      --json                     Output report as JSON
  -h, --help                     Show this help

MANAGEMENT COMMANDS
      --accept <method path>           Re-fetch and update one endpoint
      --accept-all-warnings            Accept all endpoints with warnings only
      --ignore-field <endpoint> <path> Add ignore rule for specific endpoint
      --snooze <method path>           Snooze endpoint (default 7 days)
      --days <n>                       Days to snooze (use with --snooze)

EXAMPLES
  # Zero-config: check default scenario against recorded URLs
  mockifyer-drift-check

  # Check staging scenario with auth header
  mockifyer-drift-check --scenario staging --header "Authorization: Bearer \${TOKEN}"

  # Override base URL and ignore timestamp fields
  mockifyer-drift-check --base-url https://staging.api.example.com \\
    --ignore-path timestamp --ignore-path meta.requestId

  # CI mode: fail on any drift, output JSON report
  mockifyer-drift-check --fail-on-warnings --json > drift-report.json

  # Accept one endpoint's drift (re-record from live)
  mockifyer-drift-check --accept "GET /api/users/123"

  # Accept all warnings
  mockifyer-drift-check --accept-all-warnings

  # Ignore a field for a specific endpoint
  mockifyer-drift-check --ignore-field "GET /api/users/123" "lastLoginAt"

  # Snooze an endpoint for 30 days
  mockifyer-drift-check --snooze "GET /api/users/123" --days 30

ENVIRONMENT VARIABLES
  Headers can be read from environment variables. Use --header with env vars:
    mockifyer-drift-check --header "Authorization: Bearer \${API_TOKEN}"

EXIT CODES
  0  No drift detected (or warnings only without --fail-on-warnings)
  1  Breaking drift detected (or any drift with --fail-on-warnings)
  2  Error (invalid args, no mocks found, etc.)

For more information: https://mockifyer.dev/docs/drift-check
`;

  console.log(help);
}

async function main() {
  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // Check for auth headers in environment variables
  const headers = args.headers ? { ...args.headers } : undefined;
  if (headers) {
    const authEnvVars = ['API_TOKEN', 'API_KEY', 'AUTH_TOKEN', 'AUTHORIZATION'];
    for (const envVar of authEnvVars) {
      if (process.env[envVar] && !headers['Authorization']) {
        // Auto-populate Authorization header from common env vars if not explicitly set
        const value = process.env[envVar];
        if (value && !value.startsWith('Bearer ')) {
          headers['Authorization'] = `Bearer ${value}`;
        } else if (value) {
          headers['Authorization'] = value;
        }
      }
    }
  }

  // Only pass options that were explicitly set (so config file values apply)
  const driftOptions: DriftCheckOptions = {};
  if (args.baseUrl !== undefined) driftOptions.baseUrl = args.baseUrl;
  if (headers !== undefined) driftOptions.headers = headers;
  if (args.ignorePaths !== undefined) driftOptions.ignorePaths = args.ignorePaths;
  if (args.allowUnsafeMethods !== undefined) driftOptions.allowUnsafeMethods = args.allowUnsafeMethods;
  if (args.failOnWarnings !== undefined) driftOptions.failOnWarnings = args.failOnWarnings;
  if (args.concurrency !== undefined) driftOptions.concurrency = args.concurrency;
  if (args.timeoutMs !== undefined) driftOptions.timeoutMs = args.timeoutMs;
  if (args.delayMs !== undefined) driftOptions.delayMs = args.delayMs;
  if (args.noHistory !== undefined) driftOptions.noHistory = args.noHistory;

  // Handle management commands (accept, snooze, ignore-field)
  if (args.accept) {
    try {
      const [method, ...pathParts] = args.accept.split(' ');
      const path = pathParts.join(' ');
      const result = await acceptDrift({
        method,
        path,
        mockDataPath: args.mockDataPath,
        scenario: args.scenario,
        driftOptions,
      });
      if (result.success) {
        console.log(green('✓') + ` ${result.message}`);
        process.exit(0);
      } else {
        console.error(red('✗') + ` ${result.message}`);
        process.exit(2);
      }
    } catch (error: any) {
      console.error(red('Error:') + ` ${error.message}`);
      process.exit(2);
    }
  }

  if (args.acceptAllWarnings) {
    try {
      const result = await acceptAllWarnings({
        mockDataPath: args.mockDataPath,
        scenario: args.scenario,
        driftOptions,
      });
      console.log('');
      console.log(`Accepted: ${result.accepted}, Failed: ${result.failed}`);
      console.log('');
      for (const message of result.messages) {
        console.log(`  ${message}`);
      }
      console.log('');
      process.exit(result.failed > 0 ? 2 : 0);
    } catch (error: any) {
      console.error(red('Error:') + ` ${error.message}`);
      process.exit(2);
    }
  }

  if (args.ignoreField) {
    try {
      const result = await addIgnoreField({
        endpoint: args.ignoreField.endpoint,
        jsonPath: args.ignoreField.path,
      });
      if (result.success) {
        console.log(green('✓') + ` ${result.message}`);
        process.exit(0);
      } else {
        console.error(red('✗') + ` ${result.message}`);
        process.exit(2);
      }
    } catch (error: any) {
      console.error(red('Error:') + ` ${error.message}`);
      process.exit(2);
    }
  }

  if (args.snooze) {
    try {
      const [method, ...pathParts] = args.snooze.split(' ');
      const path = pathParts.join(' ');
      const days = args.days || 7;
      const result = await snoozeEndpoint({
        method,
        path,
        days,
        mockDataPath: args.mockDataPath,
        scenario: args.scenario,
      });
      if (result.success) {
        console.log(green('✓') + ` ${result.message}`);
        process.exit(0);
      } else {
        console.error(red('✗') + ` ${result.message}`);
        process.exit(2);
      }
    } catch (error: any) {
      console.error(red('Error:') + ` ${error.message}`);
      process.exit(2);
    }
  }

  try {
    const report = await checkDrift({
      scenario: args.scenario,
      mockDataPath: args.mockDataPath,
      driftOptions,
    });

    if (args.json) {
      // JSON output mode
      console.log(JSON.stringify(report, null, 2));
    } else {
      // Human-friendly output
      printReport(report);
    }

    // Exit code logic: use the effective failOnWarnings from the report
    const hasFailure =
      report.breakingDriftCount > 0 ||
      (report.failOnWarnings && report.warningOnlyCount > 0);

    process.exit(hasFailure ? 1 : 0);
  } catch (error: any) {
    console.error(`\n${red('Error:')} ${error.message}\n`);
    process.exit(2);
  }
}

/**
 * Print a human-friendly drift report.
 */
function printReport(report: any) {
  const isTTY = process.stdout.isTTY;

  // Summary line
  console.log('');
  if (report.driftedMocks === 0 && report.skippedCount === 0) {
    console.log(green('✓') + ` ${report.summary}`);
  } else if (report.driftedMocks === 0) {
    console.log(green('✓') + ` ${report.summary}`);
  } else {
    console.log(red('✗') + ` ${report.summary}`);
  }
  console.log('');

  // Group reports by drift status
  const driftedReports = report.mockReports.filter(
    (r: MockDriftReport) => r.hasDrift && !r.skipped && !r.notChecked
  );
  const skippedReports = report.mockReports.filter((r: MockDriftReport) => r.skipped);
  const notCheckedReports = report.mockReports.filter((r: MockDriftReport) => r.notChecked);

  // Print drifted mocks
  if (driftedReports.length > 0) {
    console.log(bold('Drifted mocks:'));
    console.log('');

    for (const mockReport of driftedReports) {
      const severity = mockReport.hasBreakingDrift ? red('BREAKING') : yellow('WARNING');
      console.log(`  ${severity} ${mockReport.method} ${mockReport.url}`);
      if (mockReport.mockFilePath) {
        console.log(`  ${dim('File:')} ${mockReport.mockFilePath}`);
      }

      // Group issues by severity
      const breakingIssues = mockReport.issues.filter((i: any) => i.severity === 'breaking');
      const warningIssues = mockReport.issues.filter((i: any) => i.severity === 'warning');

      if (breakingIssues.length > 0) {
        for (const issue of breakingIssues) {
          console.log(`    ${red('✗')} ${formatIssue(issue)}`);
        }
      }

      if (warningIssues.length > 0) {
        for (const issue of warningIssues) {
          console.log(`    ${yellow('⚠')} ${formatIssue(issue)}`);
        }
      }

      console.log('');
    }
  }

  // Print not checked mocks (condensed)
  if (notCheckedReports.length > 0) {
    console.log(dim(`Not checked ${notCheckedReports.length} mock(s):`));
    console.log('');

    for (const mockReport of notCheckedReports) {
      console.log(`  ${dim('–')} ${mockReport.method} ${mockReport.url}`);
      console.log(`    ${dim(mockReport.notCheckedReason || 'Not checked')}`);
    }
    console.log('');
  }

  // Print skipped mocks (condensed)
  if (skippedReports.length > 0) {
    console.log(dim(`Skipped ${skippedReports.length} mock(s):`));
    console.log('');

    for (const mockReport of skippedReports) {
      console.log(`  ${dim('○')} ${mockReport.method} ${mockReport.url}`);
      console.log(`    ${dim(mockReport.skipReason || 'Skipped')}`);
    }
    console.log('');
  }

  // Final guidance
  if (report.breakingDriftCount > 0) {
    console.log(
      yellow('→') +
        ' Breaking changes detected. Review the API changes and update your mocks.'
    );
    console.log('');
  } else if (report.warningOnlyCount > 0) {
    console.log(
      yellow('→') +
        ' New fields detected. Consider updating mocks to include the new data.'
    );
    console.log('');
  }
}

/**
 * Format a drift issue for human output.
 */
function formatIssue(issue: any): string {
  switch (issue.type) {
    case 'status_change':
      return `Status: ${issue.expected} → ${issue.actual}`;
    case 'missing_key':
      return `- ${issue.path} (${issue.expected})`;
    case 'extra_key':
      return `+ ${issue.path} (${issue.actual})`;
    case 'type_change':
      return `~ ${issue.path}: ${issue.expected} → ${issue.actual}`;
    default:
      return issue.message;
  }
}

// Terminal color helpers (only when TTY)
function isTTY(): boolean {
  return process.stdout.isTTY || false;
}

function red(text: string): string {
  return isTTY() ? `\x1b[31m${text}\x1b[0m` : text;
}

function green(text: string): string {
  return isTTY() ? `\x1b[32m${text}\x1b[0m` : text;
}

function yellow(text: string): string {
  return isTTY() ? `\x1b[33m${text}\x1b[0m` : text;
}

function dim(text: string): string {
  return isTTY() ? `\x1b[2m${text}\x1b[0m` : text;
}

function bold(text: string): string {
  return isTTY() ? `\x1b[1m${text}\x1b[0m` : text;
}

// Run CLI
if (require.main === module) {
  main().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(2);
  });
}
