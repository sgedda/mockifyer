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

/**
 * Set persistent API version badge in corner
 */
async function setApiBadge(page: Page, version: 'v1' | 'v2') {
  await page.evaluate((ver) => {
    let badge = document.getElementById('api-version-badge') as HTMLDivElement;
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'api-version-badge';
      Object.assign(badge.style, {
        position: 'fixed',
        bottom: '70px',
        left: '20px',
        padding: '8px 16px',
        fontSize: '14px',
        fontWeight: '700',
        borderRadius: '6px',
        zIndex: '999998',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
        transition: 'all 0.3s ease',
      });
      document.body.appendChild(badge);
    }
    
    badge.textContent = `Live API: ${ver.toUpperCase()}`;
    if (ver === 'v1') {
      badge.style.backgroundColor = '#10b981';
      badge.style.color = 'white';
    } else {
      badge.style.backgroundColor = '#ef4444';
      badge.style.color = 'white';
    }
  }, version);
}

/**
 * Show large centered overlay with v1 vs v2 API diff
 */
async function showApiDiffOverlay(page: Page, durationMs = 5000) {
  await page.evaluate((duration) => {
    const overlay = document.createElement('div');
    overlay.id = 'api-diff-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '9999999',
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      backgroundColor: 'white',
      borderRadius: '12px',
      padding: '32px',
      width: '60%',
      maxHeight: '80%',
      overflow: 'auto',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    });

    panel.innerHTML = `
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-block; padding: 12px 24px; background: #f3f4f6; border-radius: 8px; font-family: monospace; font-size: 18px; font-weight: 600; color: #111827;">
          GET /api/trips
        </div>
        <h2 style="margin: 16px 0 0 0; font-size: 20px; font-weight: 600; color: #6b7280;">
          Live API response changed
        </h2>
      </div>
      
      <div style="background: #fafafa; border-radius: 8px; padding: 24px; font-family: monospace; font-size: 16px; line-height: 2.2;">
        <div style="color: #6b7280; margin-bottom: 12px; font-size: 14px; font-weight: 600;">
          trips[0]:
        </div>
        
        <div style="margin-bottom: 8px;">
          <span style="background: #dc2626; color: white; padding: 4px 10px; border-radius: 4px; font-weight: 600;">− removed</span>
          <span style="color: #374151; margin-left: 12px;">"departureDate": "2026-12-01"</span>
        </div>
        
        <div style="margin-bottom: 8px;">
          <span style="background: #059669; color: white; padding: 4px 10px; border-radius: 4px; font-weight: 600;">+ added</span>
          <span style="color: #374151; margin-left: 12px;">"departsAt": "2026-12-01"</span>
        </div>
        
        <div style="margin-bottom: 8px;">
          <span style="background: #f59e0b; color: white; padding: 4px 10px; border-radius: 4px; font-weight: 600;">~ changed</span>
          <span style="color: #374151; margin-left: 12px;">"passengers": <span style="background: #fecaca; color: #991b1b; padding: 2px 6px; border-radius: 3px; font-weight: 600;">2</span> → <span style="background: #bbf7d0; color: #166534; padding: 2px 6px; border-radius: 3px; font-weight: 600;">"2"</span></span>
        </div>
        
        <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #e5e7eb; color: #dc2626; font-size: 15px; font-weight: 600;">
          ⚠ Breaking: Field renamed + type changed
        </div>
      </div>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    setTimeout(() => {
      overlay.style.transition = 'opacity 0.5s';
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 500);
    }, duration);
  }, durationMs);
  
  await page.waitForTimeout(durationMs + 500);
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

const FIXTURE_DIR = path.join(__dirname, 'mock-data/drift-watch/localhost:4100');
const BACKUP_DIR = path.join(__dirname, 'mock-data/.backup');

test.describe('Drift Detection Demo', () => {
  test.beforeAll(async () => {
    // Clean drift history from previous runs
    const driftDir = path.join(__dirname, 'mock-data/drift-watch/.drift');
    if (fs.existsSync(driftDir)) {
      fs.rmSync(driftDir, { recursive: true });
      console.log('Cleared drift history');
    }
    
    function copyDir(src: string, dest: string) {
      fs.mkdirSync(dest, { recursive: true });
      const entries = fs.readdirSync(src, { withFileTypes: true });
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
          copyDir(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }
    
    // Restore from backup if previous run was interrupted
    if (fs.existsSync(BACKUP_DIR)) {
      console.log('Found backup from interrupted run, restoring...');
      if (fs.existsSync(FIXTURE_DIR)) {
        fs.rmSync(FIXTURE_DIR, { recursive: true });
      }
      copyDir(BACKUP_DIR, FIXTURE_DIR);
      fs.rmSync(BACKUP_DIR, { recursive: true });
      console.log('Restored baseline fixtures from interrupted run');
    }
    
    // Backup baseline fixtures so --accept steps don't mutate committed files
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    copyDir(FIXTURE_DIR, BACKUP_DIR);
    console.log('Backed up baseline fixtures');
    
    // Remove booking mock for dashboard video (single-endpoint story)
    // It stays in git for cli-demo.sh and is restored by afterAll
    const bookingDir = path.join(FIXTURE_DIR, 'api/booking');
    if (fs.existsSync(bookingDir)) {
      fs.rmSync(bookingDir, { recursive: true });
      console.log('Removed booking mock (video shows trips only)');
    }
    
    console.log('Starting backend v1...');
    await startBackend('v1');
    console.log('Starting dashboard...');
    await startDashboard();
  });

  test.afterAll(() => {
    console.log('Stopping processes...');
    stopProcesses();
    
    // Restore baseline fixtures from backup
    if (fs.existsSync(BACKUP_DIR)) {
      if (fs.existsSync(FIXTURE_DIR)) {
        fs.rmSync(FIXTURE_DIR, { recursive: true });
      }
      
      function copyDir(src: string, dest: string) {
        fs.mkdirSync(dest, { recursive: true });
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);
          if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      }
      
      copyDir(BACKUP_DIR, FIXTURE_DIR);
      fs.rmSync(BACKUP_DIR, { recursive: true });
      console.log('Restored baseline fixtures');
    }
  });

  test('Full drift detection workflow', async ({ page }) => {
    test.setTimeout(120_000);

    // Capture console and page errors
    const consoleMessages: string[] = [];
    const pageErrors: string[] = [];
    
    page.on('console', msg => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleMessages.push(text);
      if (msg.type() === 'error') {
        console.log('Browser console error:', text);
      }
    });
    
    page.on('pageerror', err => {
      const text = `Page error: ${err.message}\n${err.stack}`;
      pageErrors.push(text);
      console.log(text);
    });
    
    // Capture API requests and responses
    page.on('request', async request => {
      if (request.url().includes('/api/drift/accept')) {
        console.log(`POST ${request.url()}`);
        try {
          const postData = request.postDataJSON();
          console.log('Accept request body:', JSON.stringify(postData, null, 2));
        } catch (e) {
          console.log('Could not parse request body');
        }
      }
    });
    
    page.on('response', async response => {
      if (response.url().includes('/api/drift/check')) {
        const status = response.status();
        console.log(`API /drift/check responded: ${status}`);
        try {
          const body = await response.json();
          console.log('Drift check response:', JSON.stringify(body, null, 2).substring(0, 500));
        } catch (e) {
          console.log('Could not parse drift check response');
        }
      }
      if (response.url().includes('/api/drift/accept')) {
        const status = response.status();
        console.log(`API /drift/accept responded: ${status}`);
        try {
          const body = await response.json();
          console.log('Accept response:', JSON.stringify(body, null, 2));
        } catch (e) {
          console.log('Could not parse accept response');
        }
      }
      if (response.url().includes('/api/drift/accept-warnings')) {
        const status = response.status();
        console.log(`API /drift/accept-warnings responded: ${status}`);
        try {
          const body = await response.json();
          console.log('Accept warnings response:', JSON.stringify(body, null, 2));
        } catch (e) {
          console.log('Could not parse accept-warnings response');
        }
      }
    });

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
    const driftHref = await driftNavLink.getAttribute('href');
    console.log('Drift link href:', driftHref);
    await driftNavLink.click();
    await page.waitForTimeout(1500);
    
    // Wait for Drift page to load
    console.log('After clicking Drift link, URL:', page.url());
    await expect(page.getByText(/API Drift Detection/i)).toBeVisible({ timeout: 10000 });
    console.log('Drift page loaded');
    
    // Set persistent v1 badge
    await setApiBadge(page, 'v1');
    await showCaption(page, '🟢 Live API: v1 (matches baseline mocks)', 2500);

    // Step 2: Run check against v1
    console.log('Running drift check against v1...');
    const runCheckButton = page.locator('button:has-text("Run Check Now")');
    await expect(runCheckButton).toBeVisible({ timeout: 5000 });
    await runCheckButton.click();
    
    // Wait for check to complete and verify success
    await expect(page.getByText(/no drift detected/i).first()).toBeVisible({ timeout: 10000 });
    console.log('✓ v1 check passed');
    await page.waitForTimeout(2000);

    // Step 3: Switch backend to v2 with detailed explanation
    await showCaption(page, '⚠️ Switching Live API to v2...', 2000);
    console.log('Switching backend to v2...');
    await startBackend('v2');
    
    // Update badge to v2 and show large diff overlay
    await setApiBadge(page, 'v2');
    await page.waitForTimeout(500);
    await showApiDiffOverlay(page, 5000);

    // Step 4: Run check against v2
    await showCaption(page, 'Running drift check against v2...', 1500);
    console.log('Running drift check against v2...');
    
    // We're already on /drift from step 1, dashboard doesn't navigate away
    // Just ensure the component is ready (not in loading state)
    await expect(page.getByText(/API Drift Detection/i)).toBeVisible({ timeout: 5000 });
    
    // Find the button again (it might have been recreated)
    const runCheckButton2 = page.locator('button:has-text("Run Check Now")');
    await expect(runCheckButton2).toBeVisible({ timeout: 10000 });
    await expect(runCheckButton2).toBeEnabled({ timeout: 5000 });
    await runCheckButton2.click();
    
    // Wait for drift check to complete
    await page.waitForTimeout(8000);
    
    console.log('Page URL after v2 check:', page.url());
    console.log('Page has "API Drift Detection":', await page.getByText(/API Drift Detection/i).isVisible().catch(() => false));
    
    // Look for drift indicators
    const hasBreaking = await page.getByText(/breaking/i).first().isVisible().catch(() => false);
    const hasWarning = await page.getByText(/warning/i).first().isVisible().catch(() => false);
    const hasDriftDetected = await page.getByText(/drift detected/i).isVisible().catch(() => false);
    console.log('Has Breaking:', hasBreaking, 'Has Warning:', hasWarning, 'Has "drift detected":', hasDriftDetected);
    
    // List all visible text
    const pageText = await page.locator('body').textContent();
    console.log('Page contains "Accept Live":', pageText?.includes('Accept Live'));
    console.log('Page contains "Run Check Now":', pageText?.includes('Run Check Now'));
    
    await showCaption(page, '⚠️ Breaking drift detected in /api/trips', 2500);
    console.log('✗ Drift detected');
    await page.waitForTimeout(3000);

    // Step 5: Accept drift
    await showCaption(page, 'Accepting breaking endpoint (trips)...', 2000);
    console.log('Accepting drift...');
    
    // Use exact data-testid to target trips endpoint Accept button (use .first() in case of multiple)
    const tripsAcceptButton = page.locator('[data-testid="accept-live-GET-http---localhost-4100-api-trips"]').first();
    await expect(tripsAcceptButton).toBeVisible({ timeout: 5000 });
    console.log('Found trips Accept Live button with data-testid');
    await tripsAcceptButton.click();
    
    // Wait for confirmation dialog and click "Accept" button
    await page.waitForTimeout(500);
    const dialogAcceptButton = page.locator('button:has-text("Accept"):not(:has-text("Live")):not(:has-text("Warnings"))');
    await expect(dialogAcceptButton.first()).toBeVisible({ timeout: 5000 });
    await dialogAcceptButton.first().click();
    
    // Wait for success
    await page.waitForTimeout(2000);
    console.log('✓ Drift accepted');

    // Step 6: Run final check
    await showCaption(page, 'Final check: verify all drift resolved', 2000);
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
    await showCaption(page, '✅ Endpoint in sync with v2 API!', 2500);
    await page.waitForTimeout(1500);

    console.log('Demo completed successfully!');
  });
});
