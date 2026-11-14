#!/usr/bin/env node

/**
 * Mockifyer CLI dispatcher
 * 
 * Routes to subcommands (init, try) or falls back to generate-bundle for backwards compatibility.
 * 
 * Usage:
 *   npx mockifyer init
 *   npx mockifyer try
 *   npx mockifyer [generate-bundle args...]
 */

const subcommand = process.argv[2];

if (subcommand === 'init') {
  // Remove 'init' from argv and run init CLI
  process.argv.splice(2, 1);
  const { main } = require('./init');
  main().catch((error: Error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
} else if (subcommand === 'try') {
  // Remove 'try' from argv and run try CLI
  process.argv.splice(2, 1);
  const { main } = require('./try');
  main().catch((error: Error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
} else {
  // Unknown or no subcommand: fall back to generate-bundle (legacy behavior)
  const { generateBundle } = require('./generate-bundle');
  generateBundle().catch((error: Error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
