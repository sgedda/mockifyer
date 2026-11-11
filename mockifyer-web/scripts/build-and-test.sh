#!/bin/bash
set -e

echo "Building root packages..."
cd /agent/repos/mockifyer

# Build packages in order
echo "Building mockifyer-core..."
cd packages/mockifyer-core && npm install && npm run build

echo "Building mockifyer-axios..."
cd ../mockifyer-axios && npm install && npm run build

echo "Building mockifyer-fetch..."
cd ../mockifyer-fetch && npm install && npm run build

echo "All packages built successfully!"
