const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  
  // Desktop screenshots
  const desktop = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  await desktop.goto('http://localhost:5174/');
  await desktop.waitForTimeout(2000);
  await desktop.screenshot({ path: '/opt/cursor/artifacts/start-page-desktop.png', fullPage: true });
  
  await desktop.goto('http://localhost:5174/guides/mock-drift');
  await desktop.waitForTimeout(2000);
  await desktop.screenshot({ path: '/opt/cursor/artifacts/guide-mock-drift-desktop.png', fullPage: true });
  
  await desktop.close();
  
  // Mobile screenshots
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  
  await mobile.goto('http://localhost:5174/');
  await mobile.waitForTimeout(2000);
  await mobile.screenshot({ path: '/opt/cursor/artifacts/start-page-mobile.png', fullPage: true });
  
  await mobile.goto('http://localhost:5174/guides/mock-drift');
  await mobile.waitForTimeout(2000);
  await mobile.screenshot({ path: '/opt/cursor/artifacts/guide-mock-drift-mobile.png', fullPage: true });
  
  await mobile.close();
  await browser.close();
  
  console.log('Screenshots saved to /opt/cursor/artifacts/');
})();
