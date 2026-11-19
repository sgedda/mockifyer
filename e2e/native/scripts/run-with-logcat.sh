#!/usr/bin/env bash
set -euo pipefail

# Run E2E tests while capturing logcat to /tmp/logcat.txt
# Used by .github/workflows/e2e-android.yml inside android-emulator-runner

echo "Starting logcat capture to /tmp/logcat.txt"
adb logcat -v time > /tmp/logcat.txt 2>&1 &
LOGCAT_PID=$!
echo "Logcat PID: $LOGCAT_PID"

# Ensure logcat stops when script exits (success or failure)
cleanup() {
  echo "Stopping logcat (PID $LOGCAT_PID)"
  kill "$LOGCAT_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "Emulator up; uptime (s since boot or snapshot restore): $(adb shell cat /proc/uptime)"
adb install -r ../example-projects/wanderweird-travel/apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
npx playwright test --project=android
