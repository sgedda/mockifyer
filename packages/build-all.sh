#!/bin/bash
# Build script for all packages in correct order

set -e

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

