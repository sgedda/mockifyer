import { test, expect } from '@playwright/test';

test.describe('Nested Services Demo', () => {
  test('has nested services demo button on Dashboard page', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check that the RunItButton for nested services exists
    const demoButton = page.getByRole('button', { name: /nested services.*tracing/i });
    await expect(demoButton).toBeVisible();
    
    // Verify the demo description is present
    await expect(page.getByText(/BFF calling 3 downstream services/i)).toBeVisible();
  });
  
  test('nested services demo files exist', async () => {
    const fs = require('fs');
    const path = require('path');
    
    const demoPath = path.join(__dirname, '../../demos/nested-services');
    
    // Check key demo files exist
    expect(fs.existsSync(path.join(demoPath, 'package.json'))).toBeTruthy();
    expect(fs.existsSync(path.join(demoPath, 'README.md'))).toBeTruthy();
    expect(fs.existsSync(path.join(demoPath, 'gateway.js'))).toBeTruthy();
    expect(fs.existsSync(path.join(demoPath, 'index.html'))).toBeTruthy();
    expect(fs.existsSync(path.join(demoPath, '.stackblitzrc'))).toBeTruthy();
    
    // Check mock data exists
    expect(fs.existsSync(path.join(demoPath, 'mock-data/default'))).toBeTruthy();
    expect(fs.existsSync(path.join(demoPath, 'mock-data/default/domain-path-rules.json'))).toBeTruthy();
  });
  
  test('nested services demo README has guided tour', async () => {
    const fs = require('fs');
    const path = require('path');
    
    const readmePath = path.join(__dirname, '../../demos/nested-services/README.md');
    const readme = fs.readFileSync(readmePath, 'utf8');
    
    // Verify key sections exist
    expect(readme).toContain('60-Second Guided Tour');
    expect(readme).toContain('nested services');
    expect(readme).toContain('Request tracing');
    expect(readme).toContain('Dashboard');
    expect(readme).toContain('What Makes This Better Than DevXTools');
  });
});
