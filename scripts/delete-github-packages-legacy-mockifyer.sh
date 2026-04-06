#!/bin/sh
# Deletes every published version of the legacy npm package from GitHub Packages.
#
# GitHub shows this as: https://github.com/OWNER/REPO/pkgs/npm/mockifyer
# The REST API package name is the npm package name: unscoped "mockifyer", not "@sgedda/mockifyer".
# (The repo root was once @sgedda/mockifyer in package.json; GitHub still lists the package as mockifyer.)
#
# Prerequisites: GitHub CLI (gh), Node.js. Token needs read:packages + delete:packages.
#
# Usage:
#   ./scripts/delete-github-packages-legacy-mockifyer.sh
#
# Optional env:
#   GITHUB_ORG=name     — use org packages (default: user GITHUB_OWNER)
#   GITHUB_OWNER=sgedda — when package is under a user account (default: sgedda)
#   PACKAGE_NAME=name   — override (default: mockifyer). Use '@scope/name' for scoped packages.

set -e

PACKAGE_NAME="${PACKAGE_NAME:-mockifyer}"
ENC="$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$PACKAGE_NAME")"

if [ -n "$GITHUB_ORG" ]; then
  BASE="orgs/$GITHUB_ORG/packages/npm/$ENC"
else
  OWNER="${GITHUB_OWNER:-sgedda}"
  BASE="users/$OWNER/packages/npm/$ENC"
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: https://cli.github.com/" >&2
  exit 1
fi

echo "Fetching versions: $BASE/versions"
set +e
# Merge stderr so we can detect HTTP 404 from gh
VERSIONS_JSON="$(gh api -H "Accept: application/vnd.github+json" "$BASE/versions" 2>&1)"
GH_EXIT=$?
set -e

if [ "$GH_EXIT" -ne 0 ]; then
  if echo "$VERSIONS_JSON" | grep -q -E '(404|Not Found)'; then
    echo "Nothing to delete: $PACKAGE_NAME is not on GitHub Packages under this owner (never published, already removed, or try GITHUB_ORG=your-org)."
    exit 0
  fi
  echo "$VERSIONS_JSON" >&2
  exit 1
fi

IDS="$(echo "$VERSIONS_JSON" | node -e "
const a = JSON.parse(require('fs').readFileSync(0, 'utf8'));
if (!Array.isArray(a)) {
  console.error('Unexpected JSON (expected array of versions)');
  process.exit(1);
}
if (a.length === 0) process.exit(0);
a.forEach((v) => console.log(String(v.id)));
")"

if [ -z "$IDS" ]; then
  echo "No versions to delete (package already empty or gone)."
  exit 0
fi

echo "$IDS" | while read -r VID; do
  [ -z "$VID" ] && continue
  echo "Deleting version id=$VID..."
  gh api -X DELETE "$BASE/versions/$VID"
done

echo "Finished."
