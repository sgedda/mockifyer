/**
 * Builds what CI uploads in e2e-gui-videos from the JSON report of the last run:
 *  - one side-by-side clip per dashboard GUI test (app left, dashboard right, same height, ffmpeg hstack),
 *    gui-videos/<spec>--<test title>.mp4, with the source webms copied to gui-videos/individual/;
 *  - a Markdown description next to each clip with the same base name (command, env, steps and
 *    assertions, workflow steps, local reproduce commands), and one per other test in gui-videos/other-tests/;
 *  - the run summary gui-videos/e2e-run-summary.md, also appended to $GITHUB_STEP_SUMMARY when set.
 *
 *   npm run artifacts      (after `npx playwright test`; ffmpeg comes from the ffmpeg-static devDependency)
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import { readReport, testRuns, type TestRun } from '../lib/report';
import { relativeTo, runSummary, testDoc, type RunContext, type TestFiles } from '../lib/run-docs';
import { GUI_VIDEOS_DIR, INDIVIDUAL_DIR, OTHER_TESTS_DIR, RESULTS_JSON, RUN_SUMMARY_FILE } from '../lib/videos';
import { runSteps } from '../lib/workflow';

const CLIP_HEIGHT = 800;
/** FFMPEG_PATH, else the ffmpeg-static devDependency binary (no apt needed in CI), else ffmpeg on PATH. */
const FFMPEG = process.env.FFMPEG_PATH || (ffmpegStatic && existsSync(ffmpegStatic) ? ffmpegStatic : 'ffmpeg');
const MAX_SLUG_LENGTH = 80;
/** Root of the e2e-videos artifact (see the upload step) is e2e/, of e2e-traces e2e/test-results. */
const VIDEOS_ARTIFACT_ROOT = '.';
const TRACES_ARTIFACT_ROOT = 'test-results';

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, MAX_SLUG_LENGTH);
}

function sideBySide(appVideo: string, dashboardVideo: string, out: string) {
  const filter =
    `[0:v]scale=-2:${CLIP_HEIGHT},setsar=1[app];` +
    `[1:v]scale=-2:${CLIP_HEIGHT},setsar=1[dash];` +
    '[app][dash]hstack=inputs=2[v]';
  execFileSync(FFMPEG, [
    '-y', '-loglevel', 'error',
    '-i', appVideo, '-i', dashboardVideo,
    '-filter_complex', filter, '-map', '[v]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    out,
  ], { stdio: ['ignore', 'inherit', 'pipe'] });
}

/** Clip and copies for a GUI test; the paths each artifact will show for any test. */
function filesFor(ctx: RunContext, test: TestRun, name: string): TestFiles {
  const files: TestFiles = { name, individual: [] };
  if (test.trace) files.trace = relativeTo(ctx, TRACES_ARTIFACT_ROOT, test.trace);
  if (!test.appVideo || !test.dashboardVideo) {
    if (test.appVideo) files.individual.push(relativeTo(ctx, VIDEOS_ARTIFACT_ROOT, test.appVideo));
    return files;
  }
  const individual = path.join(GUI_VIDEOS_DIR, INDIVIDUAL_DIR);
  for (const [source, suffix] of [[test.appVideo, 'app'], [test.dashboardVideo, 'dashboard']] as const) {
    const copy = path.join(individual, `${name}.${suffix}.webm`);
    copyFileSync(source, copy);
    files.individual.push(copy);
  }
  try {
    sideBySide(test.appVideo, test.dashboardVideo, path.join(GUI_VIDEOS_DIR, `${name}.mp4`));
    files.sideBySide = `${name}.mp4`;
  } catch (error) {
    files.videoError = (error as { stderr?: Buffer }).stderr?.toString().trim() || String(error);
  }
  return files;
}

async function main() {
  const report = readReport(RESULTS_JSON);
  const { steps, source } = await runSteps();
  const ctx: RunContext = { report, steps, stepsSource: source, e2eAbs: process.cwd() };

  rmSync(GUI_VIDEOS_DIR, { recursive: true, force: true });
  mkdirSync(path.join(GUI_VIDEOS_DIR, INDIVIDUAL_DIR), { recursive: true });
  mkdirSync(path.join(GUI_VIDEOS_DIR, OTHER_TESTS_DIR), { recursive: true });

  const documented = testRuns(report).map((test) => {
    const name = `${slug(path.basename(test.file, '.spec.ts'))}--${slug(test.title)}`;
    const files = filesFor(ctx, test, name);
    const isGui = Boolean(files.sideBySide || files.videoError);
    const docPath = isGui ? `${name}.md` : `${OTHER_TESTS_DIR}/${name}.md`;
    writeFileSync(path.join(GUI_VIDEOS_DIR, docPath), testDoc(ctx, test, files));
    return { test, files, docPath };
  });

  const summary = runSummary(ctx, documented);
  writeFileSync(path.join(GUI_VIDEOS_DIR, RUN_SUMMARY_FILE), summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);

  const clips = documented.filter((d) => d.files.sideBySide);
  const failedClips = documented.filter((d) => d.files.videoError);
  console.log(`[artifacts] ${clips.length} side-by-side video(s), ${documented.length} test description(s), ` +
    `workflow steps from ${source}, summary ${path.join(GUI_VIDEOS_DIR, RUN_SUMMARY_FILE)}`);
  for (const { files } of clips) console.log(`  ${path.join(GUI_VIDEOS_DIR, files.sideBySide!)}`);
  if (failedClips.length) {
    for (const { files } of failedClips) console.error(`  ${files.name}: ${files.videoError}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[artifacts] failed:', error);
  process.exitCode = 1;
});
