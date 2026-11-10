#!/bin/sh
# Start backend for e2e tests (ensures packages are built first)

set -e

# Get repo root
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "Building packages for e2e tests..."
cd "$REPO_ROOT"
sh packages/build-all.sh

echo "Starting mockifyer-web backend..."
cd "$REPO_ROOT/mockifyer-web"
npm run dev
