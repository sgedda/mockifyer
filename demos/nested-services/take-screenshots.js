import { chromium } from '@playwright/test';

async function takeScreenshots() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    console.log('→ Screenshot 1: Default scenario...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: 'screenshots/01-default-scenario.png', 
      fullPage: true 
    });
    console.log('  ✓ Saved screenshots/01-default-scenario.png');
    
    console.log('\n→ Screenshot 2: Page loaded with data...');
    await page.screenshot({ 
      path: 'screenshots/02-ui-with-data.png'
    });
    console.log('  ✓ Saved screenshots/02-ui-with-data.png');
    
    console.log('\n✅ Screenshots complete!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

takeScreenshots();
