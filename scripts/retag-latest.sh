#!/bin/bash

# Script to maintain per-package moving "latest" tags.
# Each package gets its own moving tag:
# - core-latest
# - axios-latest
# - fetch-latest
# - dashboard-latest

set -e  # Exit on error

echo "Which package latest tag to update?"
echo "  1) core"
echo "  2) axios"
echo "  3) fetch"
echo "  4) dashboard"
echo ""
read -p "Select [1-4] (default: 1): " CHOICE
CHOICE=${CHOICE:-1}

case "$CHOICE" in
  1) PKG="core" ;;
  2) PKG="axios" ;;
  3) PKG="fetch" ;;
  4) PKG="dashboard" ;;
  *) echo "❌ ERROR: Invalid selection: $CHOICE"; exit 1 ;;
esac

TAG_TO_RETAG="${PKG}-latest"

# Get the latest commit SHA from main branch (always use latest)
TAG_COMMIT=$(git rev-parse origin/main 2>/dev/null || git rev-parse main 2>/dev/null || git rev-parse HEAD)

echo ""
echo "📌 Moving tag to retag: $TAG_TO_RETAG"
echo "📍 Current tag points to: $(git rev-list -n 1 "$TAG_TO_RETAG" 2>/dev/null || echo 'not set')"
echo "📍 Will point tag to: $TAG_COMMIT"
echo "📍 Commit message: $(git log -1 --pretty=format:'%s' "$TAG_COMMIT")"
echo ""

# Confirm with user
read -p "⚠️  This will delete and recreate tag '$TAG_TO_RETAG' pointing to latest commit. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Aborted"
  exit 1
fi

# Delete tag locally (if any)
echo "🗑️  Deleting tag locally (if exists): $TAG_TO_RETAG"
git tag -d "$TAG_TO_RETAG" >/dev/null 2>&1 || echo "⚠️  Tag not found locally"

# Delete tag remotely (if any)
echo "🗑️  Deleting tag remotely (if exists): $TAG_TO_RETAG"
git push origin ":refs/tags/$TAG_TO_RETAG" >/dev/null 2>&1 || echo "⚠️  Tag not found remotely"

# Create the tag again pointing to the latest commit
echo "🏷️  Creating tag again: $TAG_TO_RETAG -> $TAG_COMMIT"
git tag "$TAG_TO_RETAG" "$TAG_COMMIT"

# Push the tag to remote
echo "🚀 Pushing tag to remote: $TAG_TO_RETAG"
git push origin "$TAG_TO_RETAG"

echo "✅ Successfully recreated and pushed tag: $TAG_TO_RETAG"