#!/bin/bash
# Build script for all packages in correct order

set -e

# Get the directory where the script is located (packages/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Change to the packages directory
cd "$SCRIPT_DIR"

# Verify we're in the packages directory
if [ ! -d "mockifyer-core" ]; then
  echo "❌ Error: mockifyer-core directory not found in $SCRIPT_DIR"
  echo "Current directory: $(pwd)"
  echo "Contents:"
  ls -la
  exit 1
fi

# Store absolute path to packages directory
PACKAGES_DIR="$(pwd)"

echo "🔧 Building mockifyer-core..."
cd "$PACKAGES_DIR/mockifyer-core"
npm install
npm run build

echo "🔧 Building mockifyer-axios..."
cd "$PACKAGES_DIR/mockifyer-axios"
npm install
npm run build

echo "🔧 Building mockifyer-fetch..."
cd "$PACKAGES_DIR/mockifyer-fetch"
npm install
npm run build

echo "✅ All packages built successfully!"

