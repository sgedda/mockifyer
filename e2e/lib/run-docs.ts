import os from 'node:os';
import path from 'node:path';
import { ACTOR_LABEL } from './docs';
import { PRESENTATION_ENV, PRESENTATION_HOLD_MS, PRESENTATION_NAV_HOLD_MS, presentationOn } from './env';
import { E2E_DIR, REPO_ROOT_PLACEHOLDER, type PlaywrightReport, type TestRun } from './report';
import { ARTIFACT, GUI_VIDEOS_DIR, INDIVIDUAL_DIR, RUN_SUMMARY_FILE } from './videos';
import { STEP_KIND, WORKFLOW_FILE, type WorkflowStep } from './workflow';

const ARTIFACTS_SCRIPT = 'npm run artifacts';
const MS_PER_MINUTE = 60_000;
/** Workflow steps that bring up the stack under test; with the Wait steps they are the local reproduce recipe. */
const STACK_KINDS = new Set<string>([STEP_KIND.mockifyer, STEP_KIND.demo]);

/** Everything about the run that is the same for every test document. */
export interface RunContext {
  report: PlaywrightReport;
  steps: WorkflowStep[];
  stepsSource: 'job' | 'yaml';
  /** Absolute e2e/ folder, to make attachment paths relative. */
  e2eAbs: string;
}

/** Where a test's files ended up, relative to each artifact's root. */
export interface TestFiles {
  /** Base name shared by the mp4 and the md (GUI tests). */
  name: string;
  sideBySide?: string;
  videoError?: string;
  individual: string[];
  trace?: string;
}

function shellQuote(arg: string): string {
  return /^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`;
}

function duration(ms: number): string {
  if (ms >= MS_PER_MINUTE) return `${(ms / MS_PER_MINUTE).toFixed(1)} min`;
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;
}

function result(test: TestRun): string {
  if (test.outcome === 'flaky') return `flaky (passed on retry ${test.retry})`;
  if (test.outcome === 'skipped') return 'skipped';
  return test.retry > 0 ? `${test.status} (retry ${test.retry})` : test.status;
}

/** Never let the machine's hostname into a document, whatever a log line or env value contained. */
export function redactHostname(text: string): string {
  const names = new Set([os.hostname(), os.hostname().split('.')[0]].filter((n) => n.length >= 3));
  let out = text;
  for (const name of names) out = out.split(name).join('<host>');
  return out;
}

export function testCommand(ctx: RunContext): string {
  const args = (ctx.report.config.argv ?? []).slice(2).map(shellQuote);
  return ['npx', 'playwright', ...(args.length ? args : ['test'])].join(' ');
}

function runEnv(ctx: RunContext): Record<string, string> {
  return ctx.report.config.metadata?.env ?? {};
}

/** Presentation mode as recorded for the run; it only changes the timing of GUI tests. */
function presentationMode(ctx: RunContext, test?: TestRun): string {
  const value = runEnv(ctx)[PRESENTATION_ENV];
  if (!presentationOn(value)) return `off (\`${PRESENTATION_ENV}\` ${value === undefined ? 'unset' : `= ${value}`}; normal speed)`;
  if (test && !(test.appVideo && test.dashboardVideo)) return `on (\`${PRESENTATION_ENV}=${value}\`), no effect on this test (GUI tests only)`;
  return `on (\`${PRESENTATION_ENV}=${value}\`): GUI tests hold ${PRESENTATION_HOLD_MS / 1000} s, outline the element and type visibly at each value change, and hold ${PRESENTATION_NAV_HOLD_MS / 1000} s on each navigation click`;
}

function runLink(): string {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT } = process.env;
  if (!GITHUB_SERVER_URL || !GITHUB_REPOSITORY || !GITHUB_RUN_ID) return 'local run (no GitHub Actions context)';
  const url = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;
  const ref = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME;
  const sha = process.env.GITHUB_SHA?.slice(0, 7);
  return `[run ${GITHUB_RUN_ID}, attempt ${GITHUB_RUN_ATTEMPT ?? 1}](${url}) · ${process.env.GITHUB_EVENT_NAME} · \`${ref}\` @ \`${sha}\``;
}

function envLines(env: Record<string, string>): string[] {
  const keys = Object.keys(env);
  if (!keys.length) return ['- Env: none of the suite variables were set (defaults from `lib/env.ts`).'];
  return ['- Env:', ...keys.map((key) => `  - \`${key}=${env[key]}\``)];
}

function commandSection(ctx: RunContext): string[] {
  return [
    `- Working directory: \`${ctx.report.config.metadata?.cwd ?? E2E_DIR}\``,
    `- Test command (Playwright; drives the Mockifyer dashboard and the demo app): \`${testCommand(ctx)}\``,
    ...envLines(runEnv(ctx)),
    `- Afterwards (helper): \`${ARTIFACTS_SCRIPT}\` in \`${E2E_DIR}\` composed the side-by-side videos (ffmpeg \`hstack\`) and wrote these Markdown files.`,
  ];
}

function stepStatus(step: WorkflowStep): string {
  if (!step.status) return '';
  return step.durationS === undefined ? step.status : `${step.status} (${step.durationS} s)`;
}

function stepsSection(ctx: RunContext): string[] {
  const withStatus = ctx.stepsSource === 'job';
  const source = ctx.stepsSource === 'job'
    ? 'from this job (GitHub Actions API), statuses as of when the docs were written'
    : `from \`${WORKFLOW_FILE}\` (no job data available)`;
  const lines = [
    `Steps of \`${WORKFLOW_FILE}\`, job \`e2e\`, in order, ${source}.`,
    '',
    ...(withStatus
      ? ['| # | Step | Kind | Status |', '|---|---|---|---|']
      : ['| # | Step | Kind |', '|---|---|---|']),
    ...ctx.steps.map((s, i) => `| ${i + 1} | ${s.name} | ${s.kind} |${withStatus ? ` ${stepStatus(s)} |` : ''}`),
    '',
    '<details><summary>Command of each step</summary>',
    '',
  ];
  ctx.steps.forEach((step, i) => {
    if (!step.run && !step.uses) return;
    const where = step.workingDirectory ? ` (in \`${step.workingDirectory}\`)` : '';
    const condition = step.if ? `, if \`${step.if}\`` : '';
    lines.push(`${i + 1}. **${step.name}** · ${step.kind}${where}${condition}`);
    lines.push(step.run ? ['', '```bash', step.run, '```', ''].join('\n') : `   uses \`${step.uses}\``);
  });
  lines.push('</details>');
  return lines;
}

/** Same env as the run, with repo paths made relative to e2e/ so the line runs as is. */
function reproduceEnv(ctx: RunContext): string {
  return Object.entries(runEnv(ctx))
    .filter(([key]) => key !== 'CI')
    .map(([key, value]) => `${key}=${shellQuote(value.split(`${REPO_ROOT_PLACEHOLDER}/`).join('../'))}`)
    .join(' ');
}

function reproduceSection(ctx: RunContext, test?: TestRun): string[] {
  const stackSteps = ctx.steps.filter((s) => s.run && (STACK_KINDS.has(s.kind) || /^Wait/.test(s.name)));
  const env = reproduceEnv(ctx);
  const target = test ? `${test.file}:${test.line} --project=${test.project}` : '';
  const lines = [
    'From the repository root, the same commands the workflow ran, each in a subshell so it starts at the root',
    '(Node 20; see the README "Run locally"):',
    '',
  ];
  stackSteps.forEach((step, i) => {
    lines.push(`${i + 1}. ${step.kind}: **${step.name}**`);
    lines.push(['', '```bash', '(', ...(step.workingDirectory ? [`cd ${step.workingDirectory}`] : []), step.run, ')', '```', ''].join('\n'));
  });
  lines.push(`${stackSteps.length + 1}. ${STEP_KIND.test}${test ? ', this test only' : ', the whole suite'}:`);
  lines.push(['', '```bash', `cd ${E2E_DIR} && npm ci && npx playwright install chromium`,
    `${env ? `${env} ` : ''}npx playwright test ${target}`.trimEnd(), '```', ''].join('\n'));
  lines.push(`${stackSteps.length + 2}. ${STEP_KIND.helper}: \`${ARTIFACTS_SCRIPT}\` (ffmpeg from the ffmpeg-static devDependency) for the side-by-side videos and these docs. ` +
    'All GUI tests at once: `npx playwright test --project=gui` (or `--grep @gui`).');
  return lines;
}

function stepsOfTest(test: TestRun): string[] {
  if (!test.steps.length) {
    return [`API/app test: the assertion is summarized above (no step annotations); see \`${E2E_DIR}/${test.file}:${test.line}\`.`];
  }
  return test.steps.map((s, i) => `${i + 1}. **${ACTOR_LABEL[s.actor]}**: ${s.description}`);
}

function filesRows(test: TestRun, files: TestFiles): string[] {
  const rows: string[] = [];
  if (files.sideBySide) rows.push(`| Side-by-side video | \`${files.sideBySide}\` in \`${ARTIFACT.guiVideos}\` (app left, dashboard right) |`);
  if (files.videoError) rows.push(`| Side-by-side video | not composed: ${files.videoError} |`);
  if (files.individual.length) rows.push(`| Individual videos | ${files.individual.map((f) => `\`${f}\``).join(', ')} in \`${ARTIFACT.videos}\` |`);
  if (files.trace) rows.push(`| Trace | \`${files.trace}\` in \`${ARTIFACT.traces}\` (\`npx playwright show-trace <zip>\`) |`);
  if (!rows.length) rows.push(`| Recordings | none (video and trace are kept on failure only for project \`${test.project}\`) |`);
  return rows;
}

export function testDoc(ctx: RunContext, test: TestRun, files: TestFiles): string {
  const lines = [
    `# ${test.title}`,
    '',
    test.asserts ?? '',
    '',
    '| | |',
    '|---|---|',
    `| Result | ${result(test)} |`,
    `| Duration | ${duration(test.durationMs)} |`,
    `| Presentation mode | ${presentationMode(ctx, test)} |`,
    `| Spec | \`${E2E_DIR}/${test.file}:${test.line}\`${test.describe ? ` › ${test.describe}` : ''} |`,
    `| Project | \`${test.project}\`${test.tags.length ? ` · ${test.tags.map((t) => `\`${t}\``).join(' ')}` : ''} |`,
    ...filesRows(test, files),
    `| Run | ${runLink()} |`,
    `| Run summary | \`${RUN_SUMMARY_FILE}\` in \`${ARTIFACT.guiVideos}\` |`,
    '',
    '## What the test does and asserts',
    '',
    ...stepsOfTest(test),
    ...test.notes.map((n) => `- Note (${n.type}): ${n.description ?? ''}`),
    '',
    `## Command that produced this ${files.individual.length ? 'recording' : 'test result'}`,
    '',
    ...commandSection(ctx),
    `- This test: \`${test.file}:${test.line}\`, project \`${test.project}\`, attempt ${test.retry + 1}.`,
    '',
    '## Workflow steps that produced the run',
    '',
    ...stepsSection(ctx),
    '',
    '## Reproduce locally',
    '',
    ...reproduceSection(ctx, test),
    '',
  ];
  return redactHostname(lines.join('\n'));
}

function testRow(test: TestRun, files: TestFiles, docPath: string): string {
  const video = files.sideBySide ? `\`${files.sideBySide}\`` : files.videoError ? `not composed` : '';
  return `| ${test.title} | \`${test.file}:${test.line}\` | ${result(test)} | ${duration(test.durationMs)} | ${video} | \`${docPath}\` | ${test.asserts ?? ''} |`;
}

export function runSummary(ctx: RunContext, tests: Array<{ test: TestRun; files: TestFiles; docPath: string }>): string {
  const { stats } = ctx.report;
  const gui = tests.filter((t) => t.files.sideBySide || t.files.videoError);
  const other = tests.filter((t) => !gui.includes(t));
  const header = '| Test | Spec | Result | Duration | Side-by-side video | Description | Asserts |\n|---|---|---|---|---|---|---|';
  const lines = [
    '# E2E run summary (WanderWeird + Mockifyer)',
    '',
    `- Run: ${runLink()}`,
    `- Presentation mode: ${presentationMode(ctx)}`,
    `- Result: **${stats.expected} passed, ${stats.unexpected} failed, ${stats.flaky} flaky, ${stats.skipped} skipped** in ${duration(stats.duration)} (started ${stats.startTime})`,
    ...commandSection(ctx),
    '',
    '## Artifacts',
    '',
    '| Artifact | Contents |',
    '|---|---|',
    `| \`${ARTIFACT.guiVideos}\` | side-by-side mp4 + Markdown description per GUI test, this summary, \`other-tests/*.md\` |`,
    `| \`${ARTIFACT.videos}\` | \`${GUI_VIDEOS_DIR}/${INDIVIDUAL_DIR}/*.{app,dashboard}.webm\`, other tests' videos (failures, or all with \`E2E_VIDEO=on\`) |`,
    `| \`${ARTIFACT.report}\` | Playwright HTML report |`,
    `| \`${ARTIFACT.traces}\` | \`trace.zip\` per GUI test and per failed test |`,
    `| \`${ARTIFACT.logs}\` | on failure: \`test-results/\` and service logs |`,
    '',
    `## Dashboard GUI tests (${gui.length})`,
    '',
    header,
    ...gui.map(({ test, files, docPath }) => testRow(test, files, docPath)),
    '',
    `## API and app tests (${other.length})`,
    '',
    header,
    ...other.map(({ test, files, docPath }) => testRow(test, files, docPath)),
    '',
    '## Workflow steps that produced the run',
    '',
    ...stepsSection(ctx),
    '',
    '## Reproduce locally',
    '',
    ...reproduceSection(ctx),
    '',
  ];
  return redactHostname(lines.join('\n'));
}

/** Attachment path relative to an artifact root (both absolute or relative to e2e/). */
export function relativeTo(ctx: RunContext, root: string, file: string): string {
  return path.relative(path.resolve(ctx.e2eAbs, root), path.resolve(ctx.e2eAbs, file));
}
