import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const artifactsDir = '/opt/cursor/artifacts';
mkdirSync(artifactsDir, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  
  // Desktop screenshots
  const desktopContext = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const desktopPage = await desktopContext.newPage();
  
  console.log('Taking desktop screenshots...');
  await desktopPage.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);
  await desktopPage.screenshot({ path: join(artifactsDir, 'start-page-desktop-after.png'), fullPage: true });
  console.log('✓ Desktop start page');
  
  await desktopPage.goto('http://localhost:5174/getting-started', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);
  await desktopPage.screenshot({ path: join(artifactsDir, 'getting-started-desktop-after.png'), fullPage: true });
  console.log('✓ Desktop getting started');
  
  await desktopPage.goto('http://localhost:5174/e2e-tutorial', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);
  await desktopPage.screenshot({ path: join(artifactsDir, 'e2e-tutorial-desktop-after.png'), fullPage: true });
  console.log('✓ Desktop E2E tutorial');
  
  await desktopContext.close();
  
  // Mobile screenshots
  const mobileContext = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const mobilePage = await mobileContext.newPage();
  
  console.log('Taking mobile screenshots...');
  await mobilePage.goto('http://localhost:5174/', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: join(artifactsDir, 'start-page-mobile-after.png'), fullPage: true });
  console.log('✓ Mobile start page');
  
  await mobilePage.goto('http://localhost:5174/getting-started', { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({ path: join(artifactsDir, 'getting-started-mobile-after.png'), fullPage: true });
  console.log('✓ Mobile getting started');
  
  await mobileContext.close();
  await browser.close();
  
  console.log('\n✓ All screenshots saved to', artifactsDir);
})();
