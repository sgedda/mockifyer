#!/usr/bin/env bash
set -euo pipefail

# Metro for the Android e2e: the debug APK (build-apk.sh) loads its JavaScript from here, so this is where
# the app's e2e configuration is set (Expo inlines EXPO_PUBLIC_* into the bundle):
#   EXPO_PUBLIC_MOCKIFYER_BACKEND=redis   dashboard proxy (/api/proxy), the path the web app uses; the
#                                         native default (hybrid) serves bundled mocks and ignores dashboard edits
#   EXPO_PUBLIC_MOCKIFYER_CLIENT_ID       the lane the tests drive (fixed for the whole run)
#   EXPO_PUBLIC_E2E=1                     no LogBox banners over the tab bar
#   metro.sh start   run Metro in the foreground on METRO_PORT (default 8081)
#   metro.sh warm    request the Android bundle once (first build takes minutes) and fail if it does not build

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./env.sh
source "$SCRIPT_DIR/env.sh"

BUNDLE_URL="http://127.0.0.1:$METRO_PORT/.expo/.virtual-metro-entry.bundle?platform=android&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app"
WARM_TIMEOUT_SECONDS=600

case "${1:-}" in
  start)
    cd "$WW_MOBILE_DIR"
    EXPO_PUBLIC_E2E=1 \
    EXPO_PUBLIC_MOCKIFYER_BACKEND=redis \
    EXPO_PUBLIC_MOCKIFYER_CLIENT_ID="${MOCKIFYER_CLIENT_ID:-wanderweird-demo}" \
      exec npx expo start --port "$METRO_PORT"
    ;;
  warm)
    out="$(mktemp)"
    code="$(curl -sS -o "$out" -w '%{http_code}' --max-time "$WARM_TIMEOUT_SECONDS" "$BUNDLE_URL")"
    echo "Android bundle: HTTP $code, $(wc -c < "$out") bytes"
    if [ "$code" != 200 ]; then head -c 2000 "$out"; rm -f "$out"; exit 1; fi
    rm -f "$out"
    ;;
  *)
    echo "Usage: $0 {start|warm}" >&2
    exit 2
    ;;
esac
