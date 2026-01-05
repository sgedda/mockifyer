#!/bin/bash
# Build script for all packages in correct order

set -e

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔧 Building mockifyer-core..."
cd mockifyer-core
npm install
npm run build
cd ..

echo "🔧 Building mockifyer-axios..."
cd mockifyer-axios
npm install
npm run build
cd ..

echo "🔧 Building mockifyer-fetch..."
cd mockifyer-fetch
npm install
npm run build
cd ..

echo "✅ All packages built successfully!"

