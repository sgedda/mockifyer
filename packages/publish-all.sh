#!/bin/bash
# Publish script for all packages to npm and GitHub Packages (same order)

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

PACKAGES_DIR="$(pwd)"

# Check if user is logged into npm (check npm registry, not GitHub Packages)
if ! npm whoami --registry https://registry.npmjs.org/ &> /dev/null; then
  echo "❌ Error: Not logged into npm. Please run 'npm login --registry https://registry.npmjs.org/' first."
  exit 1
fi

echo "📦 Publishing packages to npm (and GitHub Packages if GITHUB_TOKEN or GH_TOKEN is set)..."
echo ""

# Convert file: references to published versions before publishing
echo "🔄 Preparing packages for publishing..."
node "$SCRIPT_DIR/prepare-for-publish.js"
echo ""

# Temporarily override scoped registry to use npm instead of GitHub Packages
ORIGINAL_SCOPED_REGISTRY=$(npm config get @sgedda:registry 2>/dev/null || echo "")

# Set scoped registry to npm for publishing
npm config set @sgedda:registry https://registry.npmjs.org/

restore_config() {
  if [ -n "$ORIGINAL_SCOPED_REGISTRY" ]; then
    npm config set @sgedda:registry "$ORIGINAL_SCOPED_REGISTRY"
  else
    npm config delete @sgedda:registry 2>/dev/null || true
  fi
}
trap restore_config EXIT

# Publish to GitHub Packages using an isolated userconfig (no global token writes)
publish_to_github_packages() {
  local pkg_dir="$1"
  local name
  name="$(basename "$pkg_dir")"
  local token="${GITHUB_TOKEN:-$GH_TOKEN}"

  if [ -z "$token" ]; then
    echo "   ⏭️  Skipping GitHub Packages for $name (set GITHUB_TOKEN or GH_TOKEN)"
    return 0
  fi

  local tmp
  tmp="$(mktemp)"
  {
    echo "@sgedda:registry=https://npm.pkg.github.com"
    echo "//npm.pkg.github.com/:_authToken=${token}"
  } >"$tmp"

  echo "   📤 Publishing $name to GitHub Packages..."
  (
    cd "$pkg_dir"
    NPM_CONFIG_USERCONFIG="$tmp" npm publish --registry https://npm.pkg.github.com --access public
  )
  rm -f "$tmp"
}

publish_npm_then_gh() {
  local pkg_dir="$1"
  local name
  name="$(basename "$pkg_dir")"
  echo "📦 $name → npm"
  (
    cd "$pkg_dir"
    npm publish
  )
  publish_to_github_packages "$pkg_dir"
  echo ""
}

echo "1️⃣ @sgedda/mockifyer-core"
publish_npm_then_gh "$PACKAGES_DIR/mockifyer-core"

echo "2️⃣ @sgedda/mockifyer-axios"
publish_npm_then_gh "$PACKAGES_DIR/mockifyer-axios"

echo "3️⃣ @sgedda/mockifyer-fetch"
publish_npm_then_gh "$PACKAGES_DIR/mockifyer-fetch"

echo "4️⃣ @sgedda/mockifyer-dashboard"
publish_npm_then_gh "$PACKAGES_DIR/mockifyer-dashboard"

echo "✅ All packages published successfully!"
echo ""
echo "📦 Published to registry.npmjs.org:"
echo "  - @sgedda/mockifyer-core"
echo "  - @sgedda/mockifyer-axios"
echo "  - @sgedda/mockifyer-fetch"
echo "  - @sgedda/mockifyer-dashboard"
echo ""
if [ -n "${GITHUB_TOKEN:-}" ] || [ -n "${GH_TOKEN:-}" ]; then
  echo "📦 Also published to https://npm.pkg.github.com (same versions)"
  echo ""
else
  echo "ℹ️  GitHub Packages skipped (export GITHUB_TOKEN or GH_TOKEN with packages:write to publish there too)"
  echo ""
fi
echo "⏭️  Skipped: @sgedda/mockifyer-test-helper"
