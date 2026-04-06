#!/bin/sh
# Publishes the package in the current directory only if name@version is not already on npm.
# Usage: run from a package directory (e.g. packages/mockifyer-core) with NODE_AUTH_TOKEN set for npm publish.
set -e
PKG=$(node -p "require('./package.json').name")
VER=$(node -p "require('./package.json').version")
if npm view "${PKG}@${VER}" version >/dev/null 2>&1; then
  echo "⏭️  $PKG@$VER already on npm — skipping"
  exit 0
fi
npm publish
