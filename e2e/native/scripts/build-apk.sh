#!/usr/bin/env bash
set -euo pipefail

# Debug APK of the WanderWeird app for the Android e2e tests. A debug build loads its JavaScript from
# Metro (10.0.2.2:8081 on an emulator), so the EXPO_PUBLIC_* env of the tests goes on Metro (metro.sh),
# not on this build.
#   build-apk.sh             expo prebuild (android/ is generated and gitignored), then gradlew assembleDebug
#   build-apk.sh --install   also install it on the connected device (adb install -r)
# Env: ANDROID_ABI  ABI to compile native code for (default: the connected device's ABI, else x86_64)
# Prints the APK path on the last line.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./env.sh
source "$SCRIPT_DIR/env.sh"

abi="${ANDROID_ABI:-}"
if [ -z "$abi" ] && adb get-state >/dev/null 2>&1; then
  abi="$(adb shell getprop ro.product.cpu.abi | tr -d '\r')"
fi
abi="${abi:-x86_64}"

cd "$WW_MOBILE_DIR"
# prebuild rewrites the "android"/"ios" scripts of package.json to expo run:*; keep the committed file.
manifest_backup="$(mktemp)"
cp package.json "$manifest_backup"
trap 'cp "$manifest_backup" "$WW_MOBILE_DIR/package.json"; rm -f "$manifest_backup"' EXIT
npx expo prebuild --platform android --no-install
(cd android && ./gradlew assembleDebug -PreactNativeArchitectures="$abi" --console=plain)

if [ "${1:-}" = "--install" ]; then
  adb install -r "$WW_APK"
fi
echo "$WW_APK"
