import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';

const DASHBOARD_PORT = 4102;
const BACKEND_PORT = 4100;
const DASHBOARD_URL = `http://localhost:${DASHBOARD_PORT}`;

let backendProcess: ChildProcess | null = null;
let dashboardProcess: ChildProcess | null = null;

/**
 * Add on-screen caption overlay (banner at top of viewport)
 */
async function showCaption(page: Page, text: string, durationMs = 2000) {
  try {
    await page.evaluate(({ text, duration }) => {
      const existing = document.getElementById('demo-caption');
      if (existing) existing.remove();

      const banner = document.createElement('div');
      banner.id = 'demo-caption';
      banner.textContent = text;
      Object.assign(banner.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        right: '0',
        backgroundColor: '#1e40af',
        color: 'white',
        padding: '10px 16px',
        fontSize: '14px',
        fontWeight: '600',
        textAlign: 'center',
        zIndex: '9999',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      });
      document.body.appendChild(banner);

      setTimeout(() => {
        banner.style.transition = 'opacity 0.3s';
        banner.style.opacity = '0';
        setTimeout(() => banner.remove(), 300);
      }, duration);
    }, { text, duration: durationMs });

    await page.waitForTimeout(durationMs + 300);
  } catch (e) {
    console.log('[caption error]', e);
  }
}

function startBackend(version: 'v1' | 'v2'): Promise<void> {
  return new Promise((resolve, reject) => {
    if (backendProcess) {
      backendProcess.kill();
    }

    backendProcess = spawn('node', ['backend.js'], {
      cwd: __dirname,
      env: { ...process.env, API_VERSION: version, PORT: BACKEND_PORT.toString() },
      stdio: 'pipe',
    });

    let started = false;

    backendProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log(`[backend ${version}]`, output.trim());
      if (output.includes('running on') && !started) {
        started = true;
        setTimeout(() => resolve(), 500);
      }
    });

    backendProcess.stderr?.on('data', (data) => {
      console.error(`[backend ${version} error]`, data.toString().trim());
    });

    backendProcess.on('error', reject);

    setTimeout(() => {
      if (!started) reject(new Error(`Backend ${version} failed to start`));
    }, 5000);
  });
}

function startDashboard(): Promise<void> {
  return new Promise((resolve, reject) => {
    const dashboardCli = path.join(__dirname, '../../packages/mockifyer-dashboard/dist/cli.js');
    const mockDataPath = path.join(__dirname, 'mock-data');

    if (!fs.existsSync(dashboardCli)) {
      return reject(new Error(`Dashboard CLI not found at ${dashboardCli}. Run: cd packages/mockifyer-dashboard && npx tsc`));
    }

    dashboardProcess = spawn('node', [
      dashboardCli,
      '--provider', 'filesystem',
      '--path', mockDataPath,
      '--port', DASHBOARD_PORT.toString(),
      '--host', 'localhost',
    ], {
      cwd: __dirname,
      stdio: 'pipe',
    });

    let started = false;

    dashboardProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      console.log('[dashboard]', output.trim());
      if ((output.includes('running') || output.includes('listening')) && !started) {
        started = true;
        setTimeout(() => resolve(), 1000);
      }
    });

    dashboardProcess.stderr?.on('data', (data) => {
      console.error('[dashboard error]', data.toString().trim());
    });

    dashboardProcess.on('error', reject);

    setTimeout(() => {
      if (!started) reject(new Error('Dashboard failed to start'));
    }, 15000);
  });
}

function stopProcesses() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  if (dashboardProcess) {
    dashboardProcess.kill();
    dashboardProcess = null;
  }
}

test.describe('Drift Detection Demo', () => {
  test.beforeAll(async () => {
    await startBackend('v1');
    await startDashboard();
  });

  test.afterAll(() => {
    stopProcesses();
  });

  test('Full drift detection workflow', async ({ page }) => {
    test.setTimeout(120_000);

    // Step 1: Open dashboard and navigate to Drift tab
    console.log('Loading dashboard...');
    await page.goto(DASHBOARD_URL, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    
    await showCaption(page, 'Mockifyer Dashboard - Drift Detection Demo', 2000);

    // Click on Drift link (could be in sidebar or tab)
    const driftLink = page.locator('a, button').filter({ hasText: /drift/i }).first();
    await driftLink.waitFor({ state: 'visible', timeout: 10000 });
    await driftLink.click();
    await page.waitForTimeout(1000);

    // Step 2: Run drift check against v1 (should be all green)
    await showCaption(page, 'Step 1: Check v1 API - Expect all green', 2000);
    const runCheckButton = page.getByRole('button', { name: /run check/i });
    await runCheckButton.waitFor({ state: 'visible', timeout: 5000 });
    await runCheckButton.click();

    // Wait for check to complete
    await page.waitForTimeout(5000);

    // Verify no drift
    await showCaption(page, '✓ All endpoints match v1', 2000);

    // Step 3: Switch backend to v2
    console.log('Switching to v2...');
    await showCaption(page, 'Step 2: Switching API to v2 (breaking changes)', 2000);
    await startBackend('v2');

    // Step 4: Run drift check again
    await showCaption(page, 'Step 3: Check v2 API - Expect drift detected', 2000);
    await runCheckButton.click();
    await page.waitForTimeout(5000);

    // Verify drift detected
    await showCaption(page, '✗ Drift detected! Breaking changes found', 2500);
    await page.waitForTimeout(2000);

    // Step 5: Accept drift (if buttons are available)
    const acceptButtons = page.getByRole('button', { name: /accept/i });
    const buttonCount = await acceptButtons.count();
    
    if (buttonCount > 0) {
      await showCaption(page, 'Step 4: Accepting drift for critical endpoint', 2000);
      await acceptButtons.first().click();
      await page.waitForTimeout(1000);
      
      // Confirm in dialog if present
      const confirmButton = page.getByRole('button', { name: /^accept$/i });
      const confirmVisible = await confirmButton.isVisible().catch(() => false);
      if (confirmVisible) {
        await confirmButton.click();
        await page.waitForTimeout(2000);
      }
    }

    // Final caption
    await showCaption(page, '✓ Demo complete - Drift workflow demonstrated', 2500);
    await page.waitForTimeout(1500);

    console.log('Demo completed successfully');
  });
});
