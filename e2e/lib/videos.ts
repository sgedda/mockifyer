/** JSON report scripts/build-run-artifacts.ts reads (relative to e2e/). */
export const RESULTS_JSON = 'test-results/results.json';
/** Playwright's own attachment for the `page` fixture recording (the app). */
export const APP_VIDEO_ATTACHMENT = 'video';
/** Attachment the GUI fixture adds for the dashboard page recording. */
export const DASHBOARD_VIDEO_ATTACHMENT = 'dashboard-video';
/**
 * Output of scripts/build-run-artifacts.ts: side-by-side mp4s and a Markdown description per GUI test,
 * the run summary, descriptions of the other tests in OTHER_TESTS_DIR and the source webms in INDIVIDUAL_DIR.
 */
export const GUI_VIDEOS_DIR = 'gui-videos';
export const OTHER_TESTS_DIR = 'other-tests';
export const INDIVIDUAL_DIR = 'individual';
export const RUN_SUMMARY_FILE = 'e2e-run-summary.md';

/** Artifact names uploaded by .github/workflows/e2e.yml. */
export const ARTIFACT = {
  guiVideos: 'e2e-gui-videos',
  videos: 'e2e-videos',
  report: 'e2e-report',
  traces: 'e2e-traces',
  logs: 'e2e-logs',
} as const;
