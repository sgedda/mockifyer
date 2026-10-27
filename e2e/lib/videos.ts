/** JSON report the compose script reads to find each GUI test's videos (relative to e2e/). */
export const RESULTS_JSON = 'test-results/results.json';
/** Playwright's own attachment for the `page` fixture recording (the app). */
export const APP_VIDEO_ATTACHMENT = 'video';
/** Attachment the GUI fixture adds for the dashboard page recording. */
export const DASHBOARD_VIDEO_ATTACHMENT = 'dashboard-video';
/** Output of scripts/compose-gui-videos.ts: side-by-side mp4s, plus the source webms in `individual/`. */
export const GUI_VIDEOS_DIR = 'gui-videos';
