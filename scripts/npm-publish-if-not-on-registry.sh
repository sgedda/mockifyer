#!/bin/sh
# Publishes the package in the current directory to npmjs, then to GitHub Packages,
# skipping each registry when name@version is already present (safe for reruns).
# Usage: run from a package directory (e.g. packages/mockifyer-core).
#   - NODE_AUTH_TOKEN: npm token for registry.npmjs.org (npm publish)
#   - GITHUB_TOKEN: GitHub token with packages:write (GitHub Packages), optional
set -e
PKG=$(node -p "require('./package.json').name")
VER=$(node -p "require('./package.json').version")

if npm view "${PKG}@${VER}" version >/dev/null 2>&1; then
  echo "⏭️  $PKG@$VER already on npm — skipping npm publish"
else
  npm publish
fi

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "⏭️  GITHUB_TOKEN not set — skipping GitHub Packages"
  exit 0
fi

TMP=$(mktemp)
{
  echo "@sgedda:registry=https://npm.pkg.github.com"
  echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}"
} >"$TMP"

if NPM_CONFIG_USERCONFIG="$TMP" npm view "${PKG}@${VER}" version --registry https://npm.pkg.github.com >/dev/null 2>&1; then
  echo "⏭️  $PKG@$VER already on GitHub Packages — skipping"
  rm -f "$TMP"
  exit 0
fi

echo "📤 Publishing $PKG@$VER to GitHub Packages..."
NPM_CONFIG_USERCONFIG="$TMP" npm publish --registry https://npm.pkg.github.com --access public
rm -f "$TMP"
