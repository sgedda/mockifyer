#!/bin/bash
# Publish script for all packages to npm in correct order

set -e

# Get the directory where the script is located (packages/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Change to the packages directory
cd "$SCRIPT_DIR"

# Verify we're in the packages directory
if [ ! -d "mockifyer-core" ]; then
  echo "❌ Error: mockifyer-core directory not found in $SCRIPT_DIR"
  echo "Current directory: $(pwd)"
  exit 1
fi

# Store absolute path to packages directory
PACKAGES_DIR="$(pwd)"

# Check if user is logged into npm (check npm registry, not GitHub Packages)
if ! npm whoami --registry https://registry.npmjs.org/ &> /dev/null; then
  echo "❌ Error: Not logged into npm. Please run 'npm login --registry https://registry.npmjs.org/' first."
  exit 1
fi

echo "📦 Publishing packages to npm..."
echo ""

# Convert file: references to published versions before publishing
echo "🔄 Preparing packages for publishing..."
node "$SCRIPT_DIR/prepare-for-publish.js"
echo ""

# Temporarily override scoped registry to use npm instead of GitHub Packages
ORIGINAL_SCOPED_REGISTRY=$(npm config get @sgedda:registry 2>/dev/null || echo "")

# Set scoped registry to npm for publishing
npm config set @sgedda:registry https://registry.npmjs.org/

# Function to restore original config on exit
restore_config() {
  if [ -n "$ORIGINAL_SCOPED_REGISTRY" ]; then
    npm config set @sgedda:registry "$ORIGINAL_SCOPED_REGISTRY"
  else
    npm config delete @sgedda:registry
  fi
}
trap restore_config EXIT

# Publish packages in dependency order
echo "1️⃣ Publishing @sgedda/mockifyer-core..."
cd "$PACKAGES_DIR/mockifyer-core"
npm publish

echo ""
echo "2️⃣ Publishing @sgedda/mockifyer-axios..."
cd "$PACKAGES_DIR/mockifyer-axios"
npm publish

echo ""
echo "3️⃣ Publishing @sgedda/mockifyer-fetch..."
cd "$PACKAGES_DIR/mockifyer-fetch"
npm publish

echo ""
echo "4️⃣ Publishing @sgedda/mockifyer-dashboard..."
cd "$PACKAGES_DIR/mockifyer-dashboard"
npm publish

echo ""
echo "✅ All packages published successfully!"
echo ""
echo "📦 Published packages:"
echo "  - @sgedda/mockifyer-core"
echo "  - @sgedda/mockifyer-axios"
echo "  - @sgedda/mockifyer-fetch"
echo "  - @sgedda/mockifyer-dashboard"
echo ""
echo "⏭️  Skipped: @sgedda/mockifyer-test-helper"
