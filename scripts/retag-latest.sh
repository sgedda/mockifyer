#!/bin/bash

# Script to delete a tag, recreate it pointing to latest main/HEAD, and push to remote
# This is useful for fixing tags or re-tagging a commit

set -e  # Exit on error

# Get the latest tag
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

if [ -z "$LATEST_TAG" ]; then
  echo "❌ ERROR: No tags found in repository"
  exit 1
fi

# Show recent tags
echo "📋 Recent tags:"
git tag --sort=-version:refname | head -10 | nl -w2 -s'. '

# Ask which tag to retag (default to latest)
echo ""
read -p "Which tag to retag? [default: $LATEST_TAG] " TAG_TO_RETAG
TAG_TO_RETAG=${TAG_TO_RETAG:-$LATEST_TAG}

# Verify the tag exists
if ! git rev-parse "$TAG_TO_RETAG" >/dev/null 2>&1; then
  echo "❌ ERROR: Tag '$TAG_TO_RETAG' does not exist"
  exit 1
fi

# Get the latest commit SHA from main branch (always use latest)
TAG_COMMIT=$(git rev-parse origin/main 2>/dev/null || git rev-parse main 2>/dev/null || git rev-parse HEAD)

echo ""
echo "📌 Tag to retag: $TAG_TO_RETAG"
echo "📍 Current tag points to: $(git rev-list -n 1 "$TAG_TO_RETAG" 2>/dev/null || echo 'unknown')"
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

# Delete tag locally
echo "🗑️  Deleting tag locally: $TAG_TO_RETAG"
git tag -d "$TAG_TO_RETAG" || echo "⚠️  Tag not found locally (may have already been deleted)"

# Delete tag remotely
echo "🗑️  Deleting tag remotely: $TAG_TO_RETAG"
git push origin ":refs/tags/$TAG_TO_RETAG" || echo "⚠️  Tag not found remotely (may have already been deleted)"

# Create the tag again pointing to the latest commit
echo "🏷️  Creating tag again: $TAG_TO_RETAG -> $TAG_COMMIT"
git tag "$TAG_TO_RETAG" "$TAG_COMMIT"

# Push the tag to remote
echo "🚀 Pushing tag to remote: $TAG_TO_RETAG"
git push origin "$TAG_TO_RETAG"

echo "✅ Successfully recreated and pushed tag: $TAG_TO_RETAG"