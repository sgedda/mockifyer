#!/bin/sh
# Build script for all packages in correct order (POSIX sh — works on Alpine without bash)

set -e

# Directory containing this script (packages/)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d "mockifyer-core" ]; then
  echo "Error: mockifyer-core directory not found in $SCRIPT_DIR"
  echo "Current directory: $(pwd)"
  ls -la
  exit 1
fi

PACKAGES_DIR="$(pwd)"

echo "Building mockifyer-core..."
cd "$PACKAGES_DIR/mockifyer-core"
npm install
npm run build

echo "Building mockifyer-axios..."
cd "$PACKAGES_DIR/mockifyer-axios"
npm install
npm run build

echo "Building mockifyer-fetch..."
cd "$PACKAGES_DIR/mockifyer-fetch"
npm install
npm run build

echo "Building mockifyer-dashboard..."
cd "$PACKAGES_DIR/mockifyer-dashboard"
npm install
npm run build

echo "All packages built successfully."
