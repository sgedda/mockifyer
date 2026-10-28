import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ASSERTS_ANNOTATION, isActor, type Actor, type Annotation } from './docs';
import {
  APP_VIDEO_ATTACHMENT,
  CLIP_TIMING_ATTACHMENT,
  DASHBOARD_VIDEO_ATTACHMENT,
  DEVICE_VIDEO_ATTACHMENT,
  EXECUTED_STEPS_ATTACHMENT,
  type ClipTiming,
  type ExecutedStep,
} from './videos';

/** Repository root; absolute paths under it are written as REPO_ROOT_PLACEHOLDER in generated docs. */
export const REPO_ROOT = path.resolve(__dirname, '../..');
export const REPO_ROOT_PLACEHOLDER = '<repo>';
const E2E_ABS = path.resolve(__dirname, '..');
/** The e2e package folder, relative to the repository root. */
export const E2E_DIR = path.relative(REPO_ROOT, E2E_ABS);

interface ReportAttachment { name: string; path?: string }
interface ReportResult { status: string; duration: number; retry: number; annotations?: Annotation[]; attachments: ReportAttachment[] }
interface ReportTest { projectName: string; status: string; annotations: Annotation[]; results: ReportResult[] }
interface ReportSpec { title: string; file: string; line: number; tags: string[]; tests: ReportTest[] }
interface ReportSuite { title: string; specs?: ReportSpec[]; suites?: ReportSuite[] }
export interface PlaywrightReport {
  /** `rootDir` is the testDir; each spec's `file` is relative to it. */
  config: { rootDir: string; argv?: string[]; metadata?: { cwd?: string; env?: Record<string, string> } };
  suites: ReportSuite[];
  stats: { startTime: string; duration: number; expected: number; unexpected: number; flaky: number; skipped: number };
}

/** One test (one project) of the run, last attempt. */
export interface TestRun {
  title: string;
  describe: string;
  /** Spec path relative to e2e/ (e.g. tests/dashboard-gui.spec.ts), as `npx playwright test` takes it there. */
  file: string;
  line: number;
  project: string;
  tags: string[];
  /** Playwright outcome: expected, unexpected, flaky or skipped. */
  outcome: string;
  /** Status of the last attempt: passed, failed, timedOut, skipped, interrupted. */
  status: string;
  retry: number;
  durationMs: number;
  asserts?: string;
  steps: Array<{ actor: Actor; description: string }>;
  notes: Annotation[];
  /** Browser page recording, or the emulator recording of an Android test. */
  appVideo?: string;
  dashboardVideo?: string;
  trace?: string;
  /** Android tests: when each recording started, to line them up. */
  clipTiming?: ClipTiming;
  /** Android tests: Maestro runs and dashboard actions as they ran. */
  executedSteps?: ExecutedStep[];
}

export function readReport(file: string): PlaywrightReport {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function readJsonAttachment<T>(file?: string): T | undefined {
  return file && existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : undefined;
}

function* specsOf(suite: ReportSuite, describe: string[] = []): Generator<{ spec: ReportSpec; describe: string[] }> {
  for (const spec of suite.specs ?? []) yield { spec, describe };
  for (const child of suite.suites ?? []) yield* specsOf(child, [...describe, child.title]);
}

/** Static annotations from the test declaration plus runtime ones pushed via test.info(), deduplicated. */
function annotationsOf(test: ReportTest, last?: ReportResult): Annotation[] {
  const seen = new Set<string>();
  return [...test.annotations, ...(last?.annotations ?? [])].filter((a) => {
    const key = `${a.type}\u0000${a.description ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function testRuns(report: PlaywrightReport): TestRun[] {
  const runs: TestRun[] = [];
  for (const suite of report.suites) {
    for (const { spec, describe } of specsOf(suite)) {
      for (const test of spec.tests) {
        const last = test.results.at(-1);
        const attachment = (name: string) => last?.attachments.find((a) => a.name === name)?.path;
        const annotations = annotationsOf(test, last);
        runs.push({
          title: spec.title,
          describe: describe.join(' › '),
          file: path.relative(E2E_ABS, path.resolve(report.config.rootDir, spec.file)),
          line: spec.line,
          project: test.projectName,
          tags: spec.tags.map((t) => (t.startsWith('@') ? t : `@${t}`)),
          outcome: test.status,
          status: last?.status ?? 'skipped',
          retry: last?.retry ?? 0,
          durationMs: last?.duration ?? 0,
          asserts: annotations.find((a) => a.type === ASSERTS_ANNOTATION)?.description,
          steps: annotations.flatMap((a) => (isActor(a.type) ? [{ actor: a.type, description: a.description ?? '' }] : [])),
          notes: annotations.filter((a) => a.type !== ASSERTS_ANNOTATION && !isActor(a.type)),
          appVideo: attachment(APP_VIDEO_ATTACHMENT) ?? attachment(DEVICE_VIDEO_ATTACHMENT),
          dashboardVideo: attachment(DASHBOARD_VIDEO_ATTACHMENT),
          trace: attachment('trace'),
          clipTiming: readJsonAttachment<ClipTiming>(attachment(CLIP_TIMING_ATTACHMENT)),
          executedSteps: readJsonAttachment<ExecutedStep[]>(attachment(EXECUTED_STEPS_ATTACHMENT)),
        });
      }
    }
  }
  return runs;
}
