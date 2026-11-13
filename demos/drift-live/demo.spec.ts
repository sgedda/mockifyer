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
 * Add on-screen caption overlay for demo clarity
 */
async function showCaption(page: Page, text: string, durationMs = 3000) {
  try {
    await page.evaluate(({ text, duration }) => {
      const existing = document.getElementById('demo-caption');
      if (existing) existing.remove();

      const banner = document.createElement('div');
      banner.id = 'demo-caption';
      banner.textContent = text;
      Object.assign(banner.style, {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'rgba(30, 64, 175, 0.95)',
        color: 'white',
        padding: '12px 24px',
        fontSize: '16px',
        fontWeight: '600',
        textAlign: 'center',
        zIndex: '999999',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        maxWidth: '80%',
      });
      document.body.appendChild(banner);

      setTimeout(() => {
        banner.style.transition = 'opacity 0.5s';
        banner.style.opacity = '0';
        setTimeout(() => banner.remove(), 500);
      }, duration);
    }, { text, duration: durationMs });

    await page.waitForTimeout(durationMs + 500);
  } catch (e) {
    console.log('[caption error]', e);
  }
}

function startBackend(version: 'v1' | 'v2'): Promise<void> {
  return new Promise((resolve, reject) => {
    const startNew = () => {
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
          setTimeout(() => resolve(), 1000);
        }
      });

      backendProcess.stderr?.on('data', (data) => {
        console.error(`[backend ${version} error]`, data.toString().trim());
      });

      backendProcess.on('error', reject);

      setTimeout(() => {
        if (!started) reject(new Error(`Backend ${version} failed to start`));
      }, 10000);
    };

    if (backendProcess) {
      backendProcess.kill();
      setTimeout(startNew, 1500);
    } else {
      startNew();
    }
  });
}

function startDashboard(): Promise<void> {
  return new Promise((resolve, reject) => {
    const dashboardCli = path.join(__dirname, '../../packages/mockifyer-dashboard/dist/cli.js');
    const mockDataPath = path.join(__dirname, 'mock-data');

    if (!fs.existsSync(dashboardCli)) {
      return reject(new Error(`Dashboard CLI not found at ${dashboardCli}`));
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
      if (output.includes('running') && !started) {
        started = true;
        setTimeout(() => resolve(), 2000);
      }
    });

    dashboardProcess.stderr?.on('data', (data) => {
      console.error('[dashboard error]', data.toString().trim());
    });

    dashboardProcess.on('error', reject);

    setTimeout(() => {
      if (!started) reject(new Error('Dashboard failed to start'));
    }, 20000);
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
    console.log('Starting backend v1...');
    await startBackend('v1');
    console.log('Starting dashboard...');
    await startDashboard();
  });

  test.afterAll(() => {
    console.log('Stopping processes...');
    stopProcesses();
  });

  test('Full drift detection workflow', async ({ page }) => {
    test.setTimeout(120_000);

    // Step 1: Navigate to dashboard root, then navigate to Drift tab
    console.log('Navigating to dashboard...');
    await page.goto(`${DASHBOARD_URL}/?scenario=drift-watch`, { 
      waitUntil: 'domcontentloaded', 
      timeout: 20000 
    });
    
    // Wait for dashboard to load
    await expect(page.getByText(/Mockifyer Dashboard/i)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);
    
    // Click Drift navigation link
    console.log('Clicking Drift navigation link...');
    const driftNavLink = page.locator('[href*="drift"]').filter({ hasText: /^Drift$/i }).first();
    await expect(driftNavLink).toBeVisible({ timeout: 5000 });
    await driftNavLink.click();
    await page.waitForTimeout(1500);
    
    // Wait for Drift page to load
    await expect(page.getByText(/API Drift Detection/i)).toBeVisible({ timeout: 10000 });
    console.log('Drift page loaded');
    
    await showCaption(page, 'Step 1: Check v1 API (expect ✓)', 2000);

    // Step 2: Run check against v1
    console.log('Running drift check against v1...');
    const runCheckButton = page.locator('button:has-text("Run Check Now")');
    await expect(runCheckButton).toBeVisible({ timeout: 5000 });
    await runCheckButton.click();
    
    // Wait for check to complete and verify success
    await expect(page.getByText(/no drift detected/i).first()).toBeVisible({ timeout: 10000 });
    console.log('✓ v1 check passed');
    await page.waitForTimeout(1500);

    // Step 3: Switch backend to v2
    await showCaption(page, 'Step 2: Switch to v2 API', 1500);
    console.log('Switching backend to v2...');
    await startBackend('v2');
    await page.waitForTimeout(500);

    // Step 4: Run check against v2
    await showCaption(page, 'Step 3: Check v2 (expect drift)', 1500);
    console.log('Running drift check against v2...');
    
    // Navigate back to Drift page if needed (dashboard might navigate away after check)
    if (!page.url().includes('/drift') || !await page.getByText(/API Drift Detection/i).isVisible().catch(() => false)) {
      console.log('Navigating back to Drift page...');
      const driftNavLink = page.locator('[href*="drift"]').filter({ hasText: /^Drift$/i }).first();
      await driftNavLink.click();
      await page.waitForTimeout(1000);
    }
    
    // Ensure we're on the Drift page
    await expect(page.getByText(/API Drift Detection/i)).toBeVisible({ timeout: 5000 });
    
    // Find the button again (it might have been recreated)
    const runCheckButton2 = page.locator('button:has-text("Run Check Now")');
    await expect(runCheckButton2).toBeVisible({ timeout: 10000 });
    await expect(runCheckButton2).toBeEnabled({ timeout: 5000 });
    await runCheckButton2.click();
    
    // Wait for drift to be detected by checking for the "Breaking" badge on an endpoint
    await expect(page.locator('.badge:has-text("Breaking")').first()).toBeVisible({ timeout: 10000 });
    console.log('✗ Drift detected');
    await page.waitForTimeout(2000);

    // Step 5: Accept drift
    await showCaption(page, 'Step 4: Accept drift changes', 1500);
    console.log('Accepting drift...');
    
    // Click "Accept Live" button for first drifted endpoint to open dialog
    const acceptLiveButton = page.locator('button:has-text("Accept Live")').first();
    await expect(acceptLiveButton).toBeVisible({ timeout: 5000 });
    await acceptLiveButton.click();
    
    // Wait for confirmation dialog and click "Accept" button
    const acceptDialogButton = page.locator('button:has-text("Accept")').filter({ hasNotText: 'Live' });
    await expect(acceptDialogButton).toBeVisible({ timeout: 5000 });
    await acceptDialogButton.click();
    
    // Wait for success toast/message
    await page.waitForTimeout(3000);
    console.log('✓ Drift accepted');

    // Step 5b: Accept all remaining warnings (booking endpoint)
    console.log('Accepting all warnings...');
    const acceptAllWarningsButton = page.locator('button:has-text("Accept All Warnings")');
    await expect(acceptAllWarningsButton).toBeVisible({ timeout: 5000 });
    await acceptAllWarningsButton.click();
    await page.waitForTimeout(3000);
    console.log('✓ All warnings accepted');

    // Step 6: Run final check
    await showCaption(page, 'Step 5: Verify resolution', 1500);
    console.log('Running final drift check...');
    
    // Navigate back to Drift page if needed
    if (!await page.getByText(/API Drift Detection/i).isVisible().catch(() => false)) {
      const driftNavLink = page.locator('[href*="drift"]').filter({ hasText: /^Drift$/i }).first();
      await driftNavLink.click();
      await page.waitForTimeout(1000);
    }
    
    const runCheckButton3 = page.locator('button:has-text("Run Check Now")');
    await expect(runCheckButton3).toBeVisible({ timeout: 10000 });
    await runCheckButton3.click();
    
    // Verify no drift - check for "All N endpoints are in sync" text
    await expect(page.getByText(/all.*endpoints are in sync/i).first()).toBeVisible({ timeout: 10000 });
    console.log('✓ Final check passed');
    await page.waitForTimeout(1500);

    // Final frame
    await showCaption(page, '✓ Drift resolved!', 1500);
    await page.waitForTimeout(1000);

    console.log('Demo completed successfully!');
  });
});
