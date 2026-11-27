# shellcheck shell=bash disable=SC2034
# (SC2034: the scripts that source this file use these variables.)
# Shared paths and defaults of the Android e2e scripts (sourced, not run).
NATIVE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$NATIVE_DIR/../.." && pwd)"
WW_MOBILE_DIR="$REPO_ROOT/example-projects/wanderweird-travel/apps/mobile"
WW_APK="$WW_MOBILE_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
METRO_PORT="${METRO_PORT:-8081}"
if [ -n "${ANDROID_HOME:-}" ]; then
  PATH="$ANDROID_HOME/platform-tools:$PATH"
fi
PATH="$HOME/.maestro/bin:$PATH"
export PATH METRO_PORT
