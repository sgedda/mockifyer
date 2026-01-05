#!/bin/bash

# Script to delete the latest tag, recreate it, and push to remote
# This is useful for fixing tags or re-tagging a commit

set -e  # Exit on error

# Get the latest tag
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

if [ -z "$LATEST_TAG" ]; then
  echo "❌ ERROR: No tags found in repository"
  exit 1
fi

echo "📌 Latest tag: $LATEST_TAG"

# Get the commit SHA that the tag points to
TAG_COMMIT=$(git rev-list -n 1 "$LATEST_TAG" 2>/dev/null || echo "")

if [ -z "$TAG_COMMIT" ]; then
  echo "❌ ERROR: Could not find commit for tag $LATEST_TAG"
  exit 1
fi

echo "📍 Tag points to commit: $TAG_COMMIT"

# Confirm with user
read -p "⚠️  This will delete and recreate tag '$LATEST_TAG'. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Aborted"
  exit 1
fi

# Delete tag locally
echo "🗑️  Deleting tag locally: $LATEST_TAG"
git tag -d "$LATEST_TAG" || echo "⚠️  Tag not found locally (may have already been deleted)"

# Delete tag remotely
echo "🗑️  Deleting tag remotely: $LATEST_TAG"
git push origin ":refs/tags/$LATEST_TAG" || echo "⚠️  Tag not found remotely (may have already been deleted)"

# Create the tag again pointing to the same commit
echo "🏷️  Creating tag again: $LATEST_TAG -> $TAG_COMMIT"
git tag "$LATEST_TAG" "$TAG_COMMIT"

# Push the tag to remote
echo "🚀 Pushing tag to remote: $LATEST_TAG"
git push origin "$LATEST_TAG"

echo "✅ Successfully recreated and pushed tag: $LATEST_TAG"

