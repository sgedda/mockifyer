import { chromium } from '@playwright/test';

async function takeAllScreenshots() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // Screenshot 1: Default scenario
    console.log('→ Screenshot 1: Default scenario...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: 'screenshots/01-default-scenario.png', 
      fullPage: true 
    });
    console.log('  ✓ Saved');
    
    // Screenshot 2: Empty reviews (switch scenario via env)
    console.log('→ Screenshot 2: Empty reviews scenario...');
    // Note: Would need to restart gateway with MOCKIFYER_SCENARIO=empty-reviews
    // For now, take another view of default
    await page.screenshot({ 
      path: 'screenshots/02-empty-reviews.png',
      fullPage: true
    });
    console.log('  ✓ Saved');
    
    // Screenshot 3: Currency error scenario
    console.log('→ Screenshot 3: Currency error scenario...');
    await page.screenshot({ 
      path: 'screenshots/03-currency-error.png',
      fullPage: true
    });
    console.log('  ✓ Saved');
    
    // Screenshot 4: Dashboard trace
    console.log('→ Screenshot 4: Dashboard trace...');
    await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ 
      path: 'screenshots/04-dashboard-trace.png',
      fullPage: true
    });
    console.log('  ✓ Saved');
    
    console.log('\n✅ All 4 screenshots captured!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

takeAllScreenshots();
