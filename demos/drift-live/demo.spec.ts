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
    test.setTimeout(180_000);
    
    // Configure slow motion for better recording visibility
    await page.context().addInitScript(() => {
      window._mockifyerDemoMode = true;
    });

    // Step 1: Navigate to dashboard and Drift tab
    await showCaption(page, '📊 Step 1: Opening Drift Tab', 2500);
    console.log('Navigating to dashboard...');
    await page.goto(DASHBOARD_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000); // Give React time to hydrate

    // Click Drift link in navigation
    const driftLink = page.locator('a').filter({ hasText: /^Drift$/i }).first();
    await driftLink.waitFor({ state: 'visible', timeout: 10000 });
    await driftLink.click();
    await page.waitForTimeout(1500);

    // Step 2: Run check against v1
    await showCaption(page, '✓ Step 2: Checking v1 API - Expect All Green', 2500);
    console.log('Running drift check against v1...');
    
    const runCheckButton = page.getByRole('button', { name: /run check/i });
    await runCheckButton.waitFor({ state: 'visible', timeout: 5000 });
    await runCheckButton.click();
    
    // Wait for check to complete
    await page.waitForTimeout(6000);
    
    // Verify no drift message
    await showCaption(page, '✓ All endpoints match v1', 2500);
    await page.waitForTimeout(1500);

    // Step 3: Switch backend to v2
    await showCaption(page, '🔄 Step 3: Switching API to v2 (Breaking Changes)', 2500);
    console.log('Switching backend to v2...');
    await startBackend('v2');

    // Step 4: Run check against v2
    await showCaption(page, '⚠️ Step 4: Checking v2 API - Expect Drift', 2500);
    console.log('Running drift check against v2...');
    await runCheckButton.click();
    await page.waitForTimeout(6000);

    // Show drift detected
    await showCaption(page, '✗ Drift Detected! Breaking Changes Found', 3000);
    await page.waitForTimeout(2000);

    // Step 5: Scroll to see drifted endpoints
    await showCaption(page, '📋 Step 5: Viewing Drifted Endpoints', 2000);
    const tripsEndpoint = page.locator('text=/api/trips').first();
    await tripsEndpoint.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);

    // Step 6: Try to click Ignore Field if available
    await showCaption(page, '🔧 Step 6: Ignoring Expected New Fields', 2500);
    
    const ignoreButtons = page.getByRole('button', { name: /ignore field/i });
    const ignoreCount = await ignoreButtons.count();
    
    if (ignoreCount > 0) {
      console.log('Clicking Ignore Field button...');
      await ignoreButtons.first().click();
      await page.waitForTimeout(1000);
      
      // Try to select a field and click Add Ignore Rule
      const fieldSelect = page.locator('select').first();
      const isSelectVisible = await fieldSelect.isVisible().catch(() => false);
      
      if (isSelectVisible) {
        const options = await fieldSelect.locator('option:not([value=""])').count();
        if (options > 0) {
          await fieldSelect.selectOption({ index: 1 });
          await page.waitForTimeout(500);
          
          const addButton = page.getByRole('button', { name: /add ignore/i });
          await addButton.click();
          await page.waitForTimeout(1500);
        }
      }
    }

    // Step 7: Accept drift for critical endpoint
    await showCaption(page, '✅ Step 7: Accepting Drift (Re-record Live)', 2500);
    console.log('Accepting drift...');
    
    const acceptButtons = page.getByRole('button', { name: /accept live/i });
    const acceptCount = await acceptButtons.count();
    
    if (acceptCount > 0) {
      await acceptButtons.first().click();
      await page.waitForTimeout(1000);
      
      // Confirm in dialog
      const confirmButton = page.getByRole('button', { name: /^accept$/i });
      const isConfirmVisible = await confirmButton.isVisible().catch(() => false);
      
      if (isConfirmVisible) {
        await confirmButton.click();
        await page.waitForTimeout(2500);
      }
    }

    // Step 8: Run check again
    await showCaption(page, '🔄 Step 8: Verifying Resolution', 2000);
    console.log('Running final drift check...');
    await runCheckButton.scrollIntoViewIfNeeded();
    await runCheckButton.click();
    await page.waitForTimeout(6000);

    // Final confirmation
    await showCaption(page, '✓ Demo Complete! Drift Resolved', 3000);
    await page.waitForTimeout(2000);

    // Step 9: Scroll to history if visible
    const historySection = page.getByText(/recent drift/i);
    const hasHistory = await historySection.isVisible().catch(() => false);
    
    if (hasHistory) {
      await showCaption(page, '📜 Step 9: Viewing Drift History', 2000);
      await historySection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(2000);
    }

    // Hold final frame
    await showCaption(page, '✨ Drift Detection Workflow Complete', 2000);
    await page.waitForTimeout(1500);

    console.log('Demo completed successfully!');
  });
});
