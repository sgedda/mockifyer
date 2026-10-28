import { existsSync } from 'node:fs';
import ffmpegStatic from 'ffmpeg-static';

/** FFMPEG_PATH, else the ffmpeg-static devDependency binary (no apt needed in CI), else ffmpeg on PATH. */
export const FFMPEG = process.env.FFMPEG_PATH || (ffmpegStatic && existsSync(ffmpegStatic) ? ffmpegStatic : 'ffmpeg');

/** JSON report scripts/build-run-artifacts.ts reads (relative to e2e/). */
export const RESULTS_JSON = 'test-results/results.json';
/** Playwright's own attachment for the `page` fixture recording (the app). */
export const APP_VIDEO_ATTACHMENT = 'video';
/** Attachment the GUI fixture adds for the dashboard page recording. */
export const DASHBOARD_VIDEO_ATTACHMENT = 'dashboard-video';
/** Android tests: the emulator screen recording (mp4), the app pane of the side-by-side clip. */
export const DEVICE_VIDEO_ATTACHMENT = 'device-video';
/** Android tests: JSON {@link ClipTiming}, so the side-by-side clip can line the two recordings up. */
export const CLIP_TIMING_ATTACHMENT = 'clip-timing';

/** Android tests: JSON ExecutedStep[], every Maestro run and dashboard action in the order it ran. */
export const EXECUTED_STEPS_ATTACHMENT = 'executed-steps';

/** When each recording of a test started (epoch ms, host clock). */
export interface ClipTiming {
  appStartedAtMs: number;
  dashboardStartedAtMs: number;
}

/** Seconds to cut from the start of each recording so both begin at the later start time. */
export function clipStartOffsets(timing?: ClipTiming): { app: number; dashboard: number } {
  if (!timing) return { app: 0, dashboard: 0 };
  const lateBy = (timing.appStartedAtMs - timing.dashboardStartedAtMs) / 1000;
  return lateBy >= 0 ? { app: 0, dashboard: lateBy } : { app: -lateBy, dashboard: 0 };
}

export interface ExecutedStep {
  /** Who ran it, e.g. "WanderWeird app (Maestro)". */
  actor: string;
  /** The exact command, or the dashboard action with its arguments. */
  title: string;
  status: 'passed' | 'failed';
  durationMs: number;
  error?: string;
}
/**
 * Output of scripts/build-run-artifacts.ts: side-by-side mp4s and a Markdown description per GUI test,
 * the run summary, descriptions of the other tests in OTHER_TESTS_DIR and the source webms in INDIVIDUAL_DIR.
 */
export const GUI_VIDEOS_DIR = 'gui-videos';
export const OTHER_TESTS_DIR = 'other-tests';
export const INDIVIDUAL_DIR = 'individual';
export const RUN_SUMMARY_FILE = 'e2e-run-summary.md';

/** Artifact names uploaded by .github/workflows/e2e.yml (and e2e-android.yml). */
export const ARTIFACT = {
  guiVideos: 'e2e-gui-videos',
  videos: 'e2e-videos',
  report: 'e2e-report',
  traces: 'e2e-traces',
  logs: 'e2e-logs',
} as const;
