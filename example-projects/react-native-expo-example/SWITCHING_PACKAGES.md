# Switching Between Local and Published Packages

This example project supports easy switching between local Mockifyer packages (for development) and published npm packages (for testing).

## Quick Commands

```bash
# Switch to LOCAL packages (for development)
npm run switch:local

# Switch to PUBLISHED packages (for testing)
npm run switch:published

# Check current status
npm run switch:status
```

## What It Does

The `switch-packages.js` script modifies `package.json` to toggle between:

- **Local packages**: Uses `file:../../packages/mockifyer-core` and `file:../../packages/mockifyer-fetch`
- **Published packages**: Uses version numbers like `^1.7.0`

## Metro Configuration

The `metro.config.js` automatically detects which mode you're using:

- **Local mode**: Adds watchFolders and extraNodeModules to resolve local packages
- **Published mode**: Uses standard npm resolution from node_modules

You'll see a console message when Metro starts indicating which mode is active:
- `[Metro] Using LOCAL Mockifyer packages`
- `[Metro] Using PUBLISHED Mockifyer packages`

## Usage Workflow

### Development (Local Packages)

1. Make changes to Mockifyer packages in `../../packages/`
2. Build the packages:
   ```bash
   cd ../../packages/mockifyer-core && npm run build
   cd ../mockifyer-fetch && npm run build
   ```
3. Switch to local packages:
   ```bash
   npm run switch:local
   ```
4. Test your changes in the React Native app

### Testing Published Packages

1. Ensure packages are published to npm
2. Switch to published packages:
   ```bash
   npm run switch:published
   ```
3. Test that everything works with the published versions

## Manual Switching

You can also use the script directly:

```bash
# Switch to local
node scripts/switch-packages.js local

# Switch to published
node scripts/switch-packages.js published

# Show status
node scripts/switch-packages.js status

# Restore from backup (if something goes wrong)
node scripts/switch-packages.js restore
```

## Notes

- The script creates a backup (`package.json.backup`) before making changes
- After switching, you need to run `npm install` (included in npm scripts)
- The backup file is automatically created and can be restored if needed
- Metro will automatically reconfigure itself based on your package.json
