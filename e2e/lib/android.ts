import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { TestInfo } from '@playwright/test';
import { DEMO_USER } from './app';
import { PRESENTATION_HOLD_MS, PRESENTATION_NAV_HOLD_MS } from './env';
import { CHANGE_HOLD_MS, FINAL_FRAME_HOLD_MS, PRESENTATION, test, type DashboardUi } from './gui';
import type { DemoApp } from './gui-demo';
import { shellQuote } from './run-docs';
import {
  CLIP_TIMING_ATTACHMENT,
  DEVICE_VIDEO_ATTACHMENT,
  EXECUTED_STEPS_ATTACHMENT,
  FFMPEG,
  type ClipTiming,
  type ExecutedStep,
} from './videos';

// The WanderWeird Android app (debug APK, JavaScript from Metro) on an emulator, driven by the Maestro
// flows in native/flows and recorded with `adb shell screenrecord`. The dashboard side of a test stays
// Playwright (`dash`). Each app step is one `maestro test` run; it and every dashboard action are logged
// with result and duration for the test's Markdown description.

const execFileAsync = promisify(execFile);
const E2E_ABS = path.resolve(__dirname, '..');
const FLOWS_DIR = path.join(E2E_ABS, 'native', 'flows');
const ADB = process.env.ANDROID_HOME ? path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb') : 'adb';
const MAESTRO_HOME_BIN = path.join(os.homedir(), '.maestro', 'bin', 'maestro');
const MAESTRO = process.env.MAESTRO_BIN ?? (existsSync(MAESTRO_HOME_BIN) ? MAESTRO_HOME_BIN : 'maestro');
/** One flow, including the first Metro bundle load of a debug build on launch. */
const MAESTRO_TIMEOUT_MS = 5 * 60_000;
const MAX_OUTPUT_BYTES = 32 * 1024 * 1024;
const OUTPUT_TAIL_CHARS = 4_000;
const STEP_ARG_MAX_CHARS = 80;
/** screenrecord stops each file after at most 180 s; longer tests record in consecutive chunks. */
const SCREENRECORD_TIME_LIMIT_S = 180;
const RECORD_WIDTH = 720;
const RECORD_BIT_RATE = 6_000_000;
/** screenrecord finishes the mp4 (moov atom) after SIGINT; pulling earlier gives a broken file. */
const RECORDING_FINALIZE_MS = 1_500;
const RECORDING_STOP_TIMEOUT_MS = 15_000;

export const STEP_ACTOR = { app: 'WanderWeird app (Maestro)', dashboard: 'Mockifyer dashboard UI (Playwright)' } as const;

/** Temperature tile text for the flows' TEMP_TEXT: Maestro matches `text` as a regex against the whole text. */
const ANY_TEMPERATURE = '-?\\d+(\\.\\d+)?°';
export const TEMPERATURE_TEXT = {
  exactly: (n: number) => `${n}°`,
  any: ANY_TEMPERATURE,
  otherThan: (excluded: number[]) => `(?!(${excluded.join('|')})°$)${ANY_TEMPERATURE}`,
};

function tail(text: unknown): string {
  const s = String(text ?? '').trim();
  return s.length > OUTPUT_TAIL_CHARS ? `…${s.slice(-OUTPUT_TAIL_CHARS)}` : s;
}

async function adb(...args: string[]): Promise<string> {
  return (await execFileAsync(ADB, args, { maxBuffer: MAX_OUTPUT_BYTES })).stdout;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Steps of one test in the order they ran, with result and duration. */
export class StepLog {
  readonly steps: ExecutedStep[] = [];

  async run<T>(actor: string, title: string, action: () => Promise<T>): Promise<T> {
    const started = Date.now();
    try {
      const result = await action();
      this.steps.push({ actor, title, status: 'passed', durationMs: Date.now() - started });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.steps.push({ actor, title, status: 'failed', durationMs: Date.now() - started, error: message.split('\n')[0] });
      throw error;
    }
  }

  attach(testInfo: TestInfo) {
    const file = testInfo.outputPath('executed-steps.json');
    writeFileSync(file, JSON.stringify(this.steps, null, 2));
    return testInfo.attach(EXECUTED_STEPS_ATTACHMENT, { path: file, contentType: 'application/json' });
  }
}

function describeArg(arg: unknown): string {
  const text = typeof arg === 'string' ? JSON.stringify(arg) : String(arg);
  return text.length > STEP_ARG_MAX_CHARS ? `${text.slice(0, STEP_ARG_MAX_CHARS)}…` : text;
}

/** `dash` with every top-level async action logged (calls between its own methods are not). */
function loggedDashboard(dash: DashboardUi, log: StepLog): DashboardUi {
  return new Proxy(dash, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);
      if (typeof value !== 'function' || typeof prop !== 'string') return value;
      return (...args: unknown[]) => {
        const result = value.apply(target, args);
        if (!(result instanceof Promise)) return result;
        return log.run(STEP_ACTOR.dashboard, `${prop}(${args.map(describeArg).join(', ')})`, () => result);
      };
    },
  });
}

/** The app on the emulator. Every value check re-opens Discover until the tile matches, then holds it. */
export class AndroidApp implements DemoApp {
  private readonly holdMs = PRESENTATION ? PRESENTATION_HOLD_MS : CHANGE_HOLD_MS;
  private readonly navHoldMs = PRESENTATION ? PRESENTATION_NAV_HOLD_MS : 0;

  constructor(private readonly log: StepLog, private readonly testInfo: TestInfo) {}

  /** `maestro test` one flow from native/flows with `env` as `-e KEY=VALUE`, logged as the exact command (paths relative to e2e/). */
  private async runFlow(flow: string, env: Record<string, string | number> = {}, { reinstallDriver = false } = {}) {
    const debugDir = this.testInfo.outputPath('maestro', flow);
    const args = [
      '--no-ansi', 'test',
      ...(reinstallDriver ? [] : ['--no-reinstall-driver']),
      `--debug-output=${debugDir}`,
      ...Object.entries(env).flatMap(([key, value]) => ['-e', `${key}=${value}`]),
      path.join(FLOWS_DIR, `${flow}.yaml`),
    ];
    const shown = ['maestro', ...args].map((arg) => shellQuote(arg.split(`${E2E_ABS}${path.sep}`).join(''))).join(' ');
    await this.log.run(STEP_ACTOR.app, shown, async () => {
      try {
        await execFileAsync(MAESTRO, args, { cwd: E2E_ABS, timeout: MAESTRO_TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES });
      } catch (error) {
        const { stdout, stderr, message } = error as { stdout?: string; stderr?: string; message: string };
        throw new Error(`maestro flow ${flow} failed (debug output: ${debugDir}):\n${tail(stdout) || message}\n${tail(stderr)}`);
      }
    });
  }

  /** Stopped, data cleared, relaunched: the login screen. */
  launchToLogin() {
    return this.runFlow('launch', {}, { reinstallDriver: true });
  }

  /** Login form as the demo user, Sign in, Discover tab; the tile then matches `tempText`. */
  signIn(tempText = TEMPERATURE_TEXT.any) {
    return this.runFlow('sign-in', {
      USERNAME: DEMO_USER,
      PASSWORD: DEMO_USER,
      TEMP_TEXT: tempText,
      NAV_HOLD_MS: this.navHoldMs,
      HOLD_MS: this.holdMs,
    });
  }

  private refetchUntil(tempText: string) {
    return this.runFlow('refetch-until', { TEMP_TEXT: tempText, HOLD_MS: this.holdMs });
  }

  shows(n: number) {
    return this.refetchUntil(TEMPERATURE_TEXT.exactly(n));
  }

  showsOtherThan(excluded: number[]) {
    return this.refetchUntil(TEMPERATURE_TEXT.otherThan(excluded));
  }

  showsSomeTemperature() {
    return this.refetchUntil(TEMPERATURE_TEXT.any);
  }
}

/** `wm size` of the device scaled to RECORD_WIDTH (even sizes, as the encoder needs). */
async function recordSize(): Promise<string> {
  const sizes = [...(await adb('shell', 'wm', 'size')).matchAll(/(\d+)x(\d+)/g)];
  const [, width, height] = sizes.at(-1) ?? [];
  if (!width || !height) return `${RECORD_WIDTH}x${Math.round((RECORD_WIDTH * 16) / 9 / 2) * 2}`;
  return `${RECORD_WIDTH}x${Math.round((Number(height) * RECORD_WIDTH) / Number(width) / 2) * 2}`;
}

/** `adb shell screenrecord` in consecutive chunks (180 s cap per file) until stopped, then one mp4. */
export class ScreenRecorder {
  private readonly chunks: Array<{ remote: string; startedAtMs: number }> = [];
  private exited: Promise<void> = Promise.resolve();
  private stopping = false;
  private size = '';
  private readonly id = Date.now();

  async start() {
    this.size = await recordSize();
    this.recordChunk();
  }

  private recordChunk() {
    const remote = `/sdcard/e2e-${this.id}-${this.chunks.length}.mp4`;
    const child = spawn(ADB, [
      'shell', 'screenrecord',
      '--time-limit', String(SCREENRECORD_TIME_LIMIT_S),
      '--size', this.size,
      '--bit-rate', String(RECORD_BIT_RATE),
      remote,
    ], { stdio: 'ignore' });
    this.chunks.push({ remote, startedAtMs: Date.now() });
    this.exited = new Promise((resolve) => {
      child.once('exit', () => {
        if (!this.stopping) this.recordChunk();
        resolve();
      });
    });
  }

  /** Stop, pull every chunk into `dir` and join them; returns the mp4 and when the first chunk started. */
  async stop(dir: string): Promise<{ file: string; startedAtMs: number }> {
    this.stopping = true;
    await adb('shell', 'pkill', '-INT', 'screenrecord').catch(() => undefined);
    await Promise.race([this.exited, sleep(RECORDING_STOP_TIMEOUT_MS)]);
    await sleep(RECORDING_FINALIZE_MS);
    mkdirSync(dir, { recursive: true });
    const local: string[] = [];
    for (const [i, chunk] of this.chunks.entries()) {
      const file = path.join(dir, `chunk-${i}.mp4`);
      await adb('pull', chunk.remote, file);
      await adb('shell', 'rm', '-f', chunk.remote);
      local.push(file);
    }
    const startedAtMs = this.chunks[0].startedAtMs;
    if (local.length === 1) return { file: local[0], startedAtMs };
    const list = path.join(dir, 'chunks.txt');
    writeFileSync(list, local.map((f) => `file '${f}'`).join('\n'));
    const file = path.join(dir, 'device.mp4');
    await execFileAsync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', file]);
    return { file, startedAtMs };
  }
}

async function expectDevice() {
  const state = (await adb('get-state').catch(() => '')).trim();
  if (state !== 'device') {
    throw new Error(`No Android device for the e2e tests (adb get-state: "${state || 'none'}"). Start an emulator first (native/README.md).`);
  }
}

/**
 * GUI tests on Android. `dash` opens the dashboard start screen first (as on web) and logs its actions;
 * `app` then launches the app to its login screen and starts the screen recording, so the clip opens on
 * login. Teardown stops the recording and attaches it, both start times and the executed steps.
 */
export const androidTest = test.extend<{ stepLog: StepLog; app: AndroidApp }>({
  stepLog: async ({}, use, testInfo) => {
    const log = new StepLog();
    await use(log);
    await log.attach(testInfo);
  },
  dash: async ({ dash, stepLog }, use) => {
    await use(loggedDashboard(dash, stepLog));
  },
  app: async ({ dash, stepLog }, use, testInfo) => {
    await expectDevice();
    const app = new AndroidApp(stepLog, testInfo);
    await app.launchToLogin();
    const recorder = new ScreenRecorder();
    await recorder.start();
    // Runs after the test body whether it passed or failed.
    await use(app);
    await sleep(PRESENTATION ? PRESENTATION_HOLD_MS : FINAL_FRAME_HOLD_MS);
    const clip = await recorder.stop(testInfo.outputPath('device-video'));
    await testInfo.attach(DEVICE_VIDEO_ATTACHMENT, { path: clip.file, contentType: 'video/mp4' });
    const timing: ClipTiming = { appStartedAtMs: clip.startedAtMs, dashboardStartedAtMs: dash.openedAtMs };
    const timingFile = testInfo.outputPath('clip-timing.json');
    writeFileSync(timingFile, JSON.stringify(timing));
    await testInfo.attach(CLIP_TIMING_ATTACHMENT, { path: timingFile, contentType: 'application/json' });
  },
});
