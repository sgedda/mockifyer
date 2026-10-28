# Native (Android) e2e: the dashboard GUI tests against the WanderWeird APK

Playwright drives the Mockifyer dashboard in Chromium, the same as in the web `gui` project. Maestro drives the
WanderWeird debug APK on an Android emulator. Each test records the emulator with `adb shell screenrecord`
and the dashboard with Playwright. `npm run artifacts` then puts the two recordings side by side, aligned on
their recorded start times, and writes a Markdown file per test (`e2e/gui-videos/`). That file has a
"Steps as run" table listing each Maestro command and dashboard action, its result and its duration.

The workflow is `.github/workflows/e2e-android.yml`. It runs nightly at 02:30 UTC and on manual dispatch,
with presentation mode on by default. It does not run on pull requests.

## Which tests run natively

| Test (web `gui` project) | Android | Why |
| --- | --- | --- |
| mock editor: new response body value | yes | |
| overrides page: field override | yes | |
| mock editor: 503 status override | yes (own test) | The app has no error state for this. wander-api answers 200 with its fallback 18°, so the test asserts 18° and that `discover-error` is not shown. |
| mock editor: delay + status override | yes | On a device, the delay is measured on the dashboard Network view (duration of the Open-Meteo hop), not in the app. The test says so in its steps. |
| header Scenario picker / lane global fallback | yes | |
| from scratch | yes | |
| Settings client lane | no | The web test switches the app's client lane at runtime. The native app's client id comes from Metro (`EXPO_PUBLIC_MOCKIFYER_CLIENT_ID`) and is fixed for the whole run. A port needs an in-app client id switch, or a Metro restart plus an app reload per lane. Not implemented. |
| Network view | no | It asserts on hop details tied to the browser page's requests. With the `redis` backend the native app uses the same dashboard proxy, so the hops should match, but this has not been observed on a device. Not ported. |
| tracing walkthrough | no | Same reason as Network view, plus it depends on the lane switch above. Not ported. |

Every app clip starts on the login screen (`launch.yaml` clears the app data first), signs in as the demo
user through the UI and taps the Discover tab. The dashboard clip starts on the dashboard start screen and
navigates by clicking.

## Prerequisites (macOS)

- Node 20 (`nvm use 20.19.5`) and JDK 17 (`brew install --cask temurin@17`)
- Android Studio with an AVD: Device Manager, then e.g. Pixel 6, API 34, Google APIs, x86_64 (arm64-v8a on Apple silicon)
- `ANDROID_HOME` set, e.g. `export ANDROID_HOME="$HOME/Library/Android/sdk"`
- Maestro: `curl -fsSL https://get.maestro.mobile.dev | bash`. It installs to `~/.maestro/bin`, which the scripts and `lib/android.ts` find without `PATH` changes.

## How to reproduce

### Demo helpers (WanderWeird stack, Metro, APK, emulator)

```bash
# 1. Build the Mockifyer packages (repo root) and install WanderWeird
sh packages/build-all.sh
(cd example-projects/wanderweird-travel && npm ci --legacy-peer-deps && cd apps/mobile && npm ci --legacy-peer-deps)

# 2. Start the emulator (Android Studio, or):
"$ANDROID_HOME/emulator/emulator" -avd <your AVD> &

# 3. WanderWeird services, following the lane: gateway :4200, wander-api :4203
(cd example-projects/wanderweird-travel && npm run dev:proxy:record)

# 4. Metro with the e2e app env (own terminal), then build the Android bundle once
cd e2e
npm run android:metro
npm run android:metro:warm

# 5. Debug APK: expo prebuild + gradlew assembleDebug for the emulator's ABI, then adb install
npm run android:apk
```

### Mockifyer commands

```bash
# Dashboard the app and the services proxy through (sqlite, demo data)
(cd example-projects/wanderweird-travel && npx mockifyer-dashboard --provider sqlite --path ./mock-data --port 3002 --host 127.0.0.1)
```

`metro.sh start` puts the app on the dashboard proxy:

- `EXPO_PUBLIC_MOCKIFYER_BACKEND=redis` sends requests through the dashboard's `/api/proxy`. The native default (`hybrid`) serves bundled mocks and ignores dashboard edits.
- `EXPO_PUBLIC_MOCKIFYER_CLIENT_ID=wanderweird-demo` is the lane the tests drive. Set `MOCKIFYER_CLIENT_ID` to override it.
- `EXPO_PUBLIC_E2E=1` hides LogBox banners so they do not cover the tab bar.

The emulator reaches the host's 127.0.0.1 as `10.0.2.2`, and the dashboard rewrites that address back to
loopback for upstream calls.

### Run

```bash
cd e2e
npm ci && npx playwright install chromium
npm run android:check-flows                   # maestro check-syntax on every flow
npm run test:android                          # E2E_ANDROID=1 playwright test --project=android
E2E_PRESENTATION=1 npm run test:android       # holds at every value change and between app steps
npm run artifacts                             # side-by-side mp4s + Markdown in gui-videos/
```

The `android` project exists only when `E2E_ANDROID=1` is set, so `npx playwright test` and e2e.yml run
exactly as before.

## Layout

- `flows/` holds the Maestro flows. `launch.yaml` opens the login screen, `sign-in.yaml` signs in and opens
  Discover, `refetch-until.yaml` switches tabs until the temperature matches (up to 3 attempts), and
  `hold.yaml` is the presentation pause. Selectors are the app's `testID`s (`login-*`, `tab-*`, `discover-*`).
- `scripts/` holds `build-apk.sh`, `metro.sh` and the shared `env.sh`.
- `../lib/android.ts` holds the Playwright fixture, the Maestro runner, the chunked `screenrecord` (3-minute
  device limit, restarted and concatenated) and the step log.
- `../lib/gui-demo.ts` holds the test bodies shared with the web GUI specs.
- `../tests/android-gui*.spec.ts` are the Android specs.
