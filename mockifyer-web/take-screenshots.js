const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  
  console.log('Taking desktop screenshots...');
  const desktop = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  await desktop.goto('http://localhost:5174/');
  await desktop.waitForTimeout(3000);
  await desktop.screenshot({ path: '/opt/cursor/artifacts/start-page-desktop-final.png', fullPage: true });
  console.log('✓ Start page desktop');
  
  await desktop.goto('http://localhost:5174/guides/mock-at-the-network-edge');
  await desktop.waitForTimeout(2000);
  await desktop.screenshot({ path: '/opt/cursor/artifacts/guide-network-edge-desktop.png', fullPage: true });
  console.log('✓ Guide desktop');
  
  await desktop.close();
  
  console.log('Taking mobile screenshots...');
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  
  await mobile.goto('http://localhost:5174/');
  await mobile.waitForTimeout(3000);
  await mobile.screenshot({ path: '/opt/cursor/artifacts/start-page-mobile-final.png', fullPage: true });
  console.log('✓ Start page mobile');
  
  await mobile.goto('http://localhost:5174/guides/mock-at-the-network-edge');
  await mobile.waitForTimeout(2000);
  await mobile.screenshot({ path: '/opt/cursor/artifacts/guide-network-edge-mobile.png', fullPage: true });
  console.log('✓ Guide mobile');
  
  await mobile.close();
  await browser.close();
  
  console.log('\n✅ All screenshots saved!');
})();
