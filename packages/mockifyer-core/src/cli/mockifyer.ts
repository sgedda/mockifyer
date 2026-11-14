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
  require('./init');
} else if (subcommand === 'try') {
  // Remove 'try' from argv and run try CLI
  process.argv.splice(2, 1);
  require('./try');
} else {
  // Unknown or no subcommand: fall back to generate-bundle (legacy behavior)
  require('./generate-bundle');
}
