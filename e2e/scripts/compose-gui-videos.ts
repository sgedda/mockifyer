/**
 * One side-by-side clip per dashboard GUI test: app on the left, dashboard on the right, both scaled
 * to the same height. Pairs the two recordings of each test through the JSON report, writes
 * gui-videos/<spec>--<test title>.mp4 and copies the source webms to gui-videos/individual/.
 *
 *   npx tsx scripts/compose-gui-videos.ts      (after `npx playwright test`; needs ffmpeg on PATH)
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { APP_VIDEO_ATTACHMENT, DASHBOARD_VIDEO_ATTACHMENT, GUI_VIDEOS_DIR, RESULTS_JSON } from '../lib/videos';

const CLIP_HEIGHT = 800;
const MAX_SLUG_LENGTH = 80;

interface Attachment { name: string; path?: string }
interface TestResult { retry: number; status: string; attachments: Attachment[] }
interface ReportSpec { title: string; file: string; tests: { results: TestResult[] }[] }
interface ReportSuite { specs?: ReportSpec[]; suites?: ReportSuite[] }

function* allSpecs(suite: ReportSuite): Generator<ReportSpec> {
  yield* suite.specs ?? [];
  for (const child of suite.suites ?? []) yield* allSpecs(child);
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, MAX_SLUG_LENGTH);
}

function sideBySide(appVideo: string, dashboardVideo: string, out: string) {
  const filter =
    `[0:v]scale=-2:${CLIP_HEIGHT},setsar=1[app];` +
    `[1:v]scale=-2:${CLIP_HEIGHT},setsar=1[dash];` +
    '[app][dash]hstack=inputs=2[v]';
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', appVideo, '-i', dashboardVideo,
    '-filter_complex', filter, '-map', '[v]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    out,
  ], { stdio: 'inherit' });
}

function main() {
  const report: ReportSuite = JSON.parse(readFileSync(RESULTS_JSON, 'utf8'));
  const individualDir = path.join(GUI_VIDEOS_DIR, 'individual');
  rmSync(GUI_VIDEOS_DIR, { recursive: true, force: true });
  mkdirSync(individualDir, { recursive: true });

  const written: string[] = [];
  for (const spec of allSpecs(report)) {
    for (const test of spec.tests) {
      const last = test.results.at(-1);
      const video = (name: string) => last?.attachments.find((a) => a.name === name)?.path;
      const appVideo = video(APP_VIDEO_ATTACHMENT);
      const dashboardVideo = video(DASHBOARD_VIDEO_ATTACHMENT);
      if (!appVideo || !dashboardVideo) continue;

      const name = `${slug(path.basename(spec.file, '.spec.ts'))}--${slug(spec.title)}`;
      copyFileSync(appVideo, path.join(individualDir, `${name}.app.webm`));
      copyFileSync(dashboardVideo, path.join(individualDir, `${name}.dashboard.webm`));
      const out = path.join(GUI_VIDEOS_DIR, `${name}.mp4`);
      sideBySide(appVideo, dashboardVideo, out);
      written.push(`${out} (${last?.status})`);
    }
  }

  if (written.length === 0) {
    console.warn(`[compose-gui-videos] no test in ${RESULTS_JSON} has both an app and a dashboard video`);
    return;
  }
  console.log(`[compose-gui-videos] ${written.length} side-by-side video(s):\n  ${written.join('\n  ')}`);
}

main();
