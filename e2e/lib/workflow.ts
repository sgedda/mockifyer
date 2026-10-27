import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { REPO_ROOT, REPO_ROOT_PLACEHOLDER } from './report';

export const WORKFLOW_FILE = '.github/workflows/e2e.yml';
const JOB_ID = 'e2e';
const API_TIMEOUT_MS = 10_000;

export const STEP_KIND = {
  mockifyer: 'Mockifyer',
  demo: 'Demo app (WanderWeird)',
  test: 'Test run (Playwright)',
  helper: 'Helper / CI tooling',
  runner: 'GitHub runner',
} as const;
export type StepKind = (typeof STEP_KIND)[keyof typeof STEP_KIND];

export interface WorkflowStep {
  name: string;
  kind: StepKind;
  run?: string;
  uses?: string;
  workingDirectory?: string;
  if?: string;
  /** From the GitHub API when the docs are built inside the job: success, failure, skipped, in_progress, pending... */
  status?: string;
  durationS?: number;
}

interface YamlStep { name?: string; run?: string; uses?: string; 'working-directory'?: string; if?: string }
interface ApiStep { name: string; status: string; conclusion: string | null; started_at?: string | null; completed_at?: string | null }

/** Demo is checked first: the Expo and services steps carry MOCKIFYER_* env but run the demo app. */
function kindOf(step: YamlStep): StepKind {
  const name = step.name ?? step.uses ?? '';
  const text = `${name}\n${step.run ?? ''}`;
  if (/playwright test/.test(step.run ?? '')) return STEP_KIND.test;
  if (/^(Checkout|Setup|Install root|Install Playwright|Install ffmpeg|Wait|Verify|Compose|Write|Upload|Debug)/i.test(name)) {
    return STEP_KIND.helper;
  }
  if (/wanderweird|expo|metro/i.test(text)) return STEP_KIND.demo;
  if (/mockifyer/i.test(text)) return STEP_KIND.mockifyer;
  return STEP_KIND.helper;
}

/** `${{ env.X }}` from the job env and `${{ github.workspace }}`, so commands read as they ran. */
function resolver(jobEnv: Record<string, string>) {
  return (text?: string) =>
    text
      ?.replace(/\$\{\{\s*env\.(\w+)\s*\}\}/g, (whole, key: string) => jobEnv[key] ?? whole)
      .replace(/\$\{\{\s*github\.workspace\s*\}\}/g, REPO_ROOT_PLACEHOLDER)
      .trimEnd();
}

export function workflowSteps(): WorkflowStep[] {
  const workflow = parse(readFileSync(path.join(REPO_ROOT, WORKFLOW_FILE), 'utf8'));
  const job = workflow.jobs[JOB_ID];
  const resolve = resolver(job.env ?? {});
  return (job.steps as YamlStep[]).map((step) => ({
    name: step.name ?? step.uses ?? 'step',
    kind: kindOf(step),
    run: resolve(step.run),
    uses: step.uses,
    workingDirectory: resolve(step['working-directory']),
    if: step.if,
  }));
}

/** The running job's steps (names and status) via the Actions API; undefined outside CI or without access. */
async function jobStepsFromApi(): Promise<ApiStep[] | undefined> {
  const { GITHUB_API_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, GITHUB_TOKEN, GITHUB_JOB } = process.env;
  if (!GITHUB_API_URL || !GITHUB_REPOSITORY || !GITHUB_RUN_ID || !GITHUB_TOKEN) return undefined;
  const url = `${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}/attempts/${GITHUB_RUN_ATTEMPT ?? 1}/jobs`;
  try {
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${GITHUB_TOKEN}`, accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[workflow] jobs API answered ${res.status}; using ${WORKFLOW_FILE} only`);
      return undefined;
    }
    const jobs: Array<{ name: string; steps?: ApiStep[] }> = (await res.json()).jobs ?? [];
    return (jobs.find((j) => j.name === (GITHUB_JOB ?? JOB_ID)) ?? jobs[0])?.steps;
  } catch (error) {
    console.warn(`[workflow] jobs API failed (${error instanceof Error ? error.message : error}); using ${WORKFLOW_FILE} only`);
    return undefined;
  }
}

function seconds(from?: string | null, to?: string | null): number | undefined {
  if (!from || !to) return undefined;
  return Math.round((Date.parse(to) - Date.parse(from)) / 1000);
}

/**
 * Steps in run order. Inside the job this is the job's own step list (incl. runner steps, with status);
 * elsewhere the YAML. YAML supplies commands and kinds either way.
 */
export async function runSteps(): Promise<{ steps: WorkflowStep[]; source: 'job' | 'yaml' }> {
  const yamlSteps = workflowSteps();
  const apiSteps = await jobStepsFromApi();
  if (!apiSteps?.length) return { steps: yamlSteps, source: 'yaml' };
  const byName = new Map(yamlSteps.map((s) => [s.name, s]));
  const steps = apiSteps.map((api) => ({
    ...(byName.get(api.name) ?? { name: api.name, kind: STEP_KIND.runner }),
    status: api.conclusion ?? api.status,
    durationS: seconds(api.started_at, api.completed_at),
  }));
  return { steps, source: 'job' };
}
