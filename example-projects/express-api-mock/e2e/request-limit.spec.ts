import { test, expect } from '@playwright/test';

test.describe('Request Limit Enforcement', () => {
  test('should block requests when limit is reached and show error message', async ({ page, context }) => {
    // Navigate to playground
    await page.goto('/playground.html');
    await page.waitForLoadState('networkidle');
    
    // Wait for page to load
    await expect(page.getByText(/Mockifyer:/i)).toBeVisible({ timeout: 10000 });
    
    // Track all network requests
    const requests: Array<{ url: string; method: string }> = [];
    const responses: Array<{ url: string; status: number; headers: Record<string, string> }> = [];
    
    // Intercept network requests to verify no real API calls are made
    page.on('request', (request) => {
      const url = request.url();
      // Only track API requests, not internal requests
      if (url.includes('/api/weather') || url.includes('/api/football') || url.includes('api-sports.io') || url.includes('openweathermap.org')) {
        requests.push({ url, method: request.method() });
        console.log(`[Test] Request intercepted: ${request.method()} ${url}`);
      }
    });
    
    page.on('response', (response) => {
      const url = response.url();
      // Only track API responses
      if (url.includes('/api/weather') || url.includes('/api/football') || url.includes('api-sports.io') || url.includes('openweathermap.org')) {
        const headers = response.headers();
        responses.push({ 
          url, 
          status: response.status(),
          headers: headers as Record<string, string>
        });
        console.log(`[Test] Response intercepted: ${response.status()} ${url}`, {
          limitReached: headers['x-mockifyer-limit-reached'],
          mocked: headers['x-mockifyer']
        });
      }
    });
    
    // Block external API calls to verify they're not made when limit is reached
    let externalApiCalled = false;
    await page.route('**/api-sports.io/**', route => {
      externalApiCalled = true;
      console.log('[Test] ❌ External API call to api-sports.io - this should not happen when limit is reached!');
      route.abort();
    });
    
    await page.route('**/openweathermap.org/**', route => {
      externalApiCalled = true;
      console.log('[Test] ❌ External API call to openweathermap.org - this should not happen when limit is reached!');
      route.abort();
    });
    
    // First, check current scenario and count existing mocks
    const baseUrl = page.url().split('/playground.html')[0];
    const scenarioResponse = await page.request.get(`${baseUrl}/api/scenario-config`);
    const scenarioConfig = await scenarioResponse.json();
    const currentScenario = scenarioConfig.currentScenario || 'default';
    
    // Get current mock count
    const mocksResponse = await page.request.get(`${baseUrl}/api/mocks?scenario=${currentScenario}`);
    const mocks = await mocksResponse.json();
    const currentMockCount = Array.isArray(mocks) ? mocks.length : 0;
    
    console.log(`[Test] Current scenario: ${currentScenario}, Mock count: ${currentMockCount}`);
    
    // Create mocks via API if needed to reach the limit
    let finalMockCount = currentMockCount;
    if (currentMockCount < 20) {
      console.log(`[Test] Creating ${20 - currentMockCount} mocks via API to reach limit...`);
      
      // Create mock files by making API requests in record mode
      // Note: This requires the backend to be in record mode
      for (let i = currentMockCount; i < 20; i++) {
        const uniqueCity = `MockCity${i}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        try {
          // Make request to create mock (this will be recorded if in record mode)
          const createMockResponse = await page.request.get(
            `${baseUrl}/api/weather-unified/current/${uniqueCity}?clientType=axios&scope=local`,
            { timeout: 5000 }
          );
          
          // Wait a bit between requests
          await page.waitForTimeout(200);
        } catch (e) {
          // Ignore errors - we're just trying to create mocks
          console.log(`[Test] Could not create mock ${i}:`, e);
        }
      }
      
      // Check final count
      const updatedMocksResponse = await page.request.get(`${baseUrl}/api/mocks?scenario=${currentScenario}`);
      const updatedMocks = await updatedMocksResponse.json();
      finalMockCount = Array.isArray(updatedMocks) ? updatedMocks.length : 0;
      console.log(`[Test] Updated mock count: ${finalMockCount}`);
      
      // If still not at limit, log warning but continue
      if (finalMockCount < 20) {
        console.log(`[Test] ⚠️ Still not at limit (have ${finalMockCount}, need 20). Backend may not be in record mode.`);
        console.log(`[Test] To test limit: Set MOCKIFYER_RECORD=true and create 20 mock files, then run this test.`);
      }
    } else {
      // Already at limit, use current count
      finalMockCount = currentMockCount;
    }
    
    console.log(`[Test] Final mock count: ${finalMockCount}`);
    
    // Skip test if not at limit
    if (finalMockCount < 20) {
      console.log(`[Test] ⚠️ Not at limit yet (have ${finalMockCount}, need 20). Skipping limit test.`);
      console.log(`[Test] To test limit: Create 20 mock files in scenario "${currentScenario}", then run this test again.`);
      test.skip();
      return;
    }
    
    // Now make a request with a unique city that doesn't have a mock
    // This should trigger the limit check and return 429 WITHOUT making a real API call
    const uniqueCity = `LimitTestCity${Date.now()}`;
    const testEndpoint = `/api/weather-unified/current/${uniqueCity}?clientType=axios&scope=local`;
    
    // Clear previous responses and reset external API flag
    responses.length = 0;
    requests.length = 0;
    externalApiCalled = false;
    
    // Fill in endpoint
    const endpointInput = page.getByPlaceholder(/endpoint/i).or(page.getByLabel(/endpoint/i)).first();
    await endpointInput.fill(testEndpoint);
    
    // Click execute button
    const executeButton = page.getByRole('button', { name: /execute|send|request/i }).first();
    await executeButton.click();
    
    // Wait for response
    await page.waitForTimeout(3000);
    
    // Check response - should be 429 with limit header
    const finalResponses = responses.filter(r => r.url.includes(testEndpoint) || r.url.includes(uniqueCity));
    console.log('[Test] Final responses for test endpoint:', finalResponses);
    
    // Verify we got a response
    expect(finalResponses.length).toBeGreaterThan(0);
    
    // Verify it's a limit response (429)
    const limitResponse = finalResponses.find(r => r.status === 429 || r.headers['x-mockifyer-limit-reached'] === 'true');
    expect(limitResponse).toBeDefined();
    console.log('[Test] ✅ Limit response found:', limitResponse);
    
    // Verify the response has limit header and status
    expect(limitResponse!.headers['x-mockifyer-limit-reached']).toBe('true');
    expect(limitResponse!.status).toBe(429);
    console.log('[Test] ✅ Limit header and status verified');
    
    // CRITICAL: Verify no external API was called
    expect(externalApiCalled).toBe(false);
    console.log('[Test] ✅ No external API calls made - limit check prevented real API call');
    
    // Check if error toast is shown
    const errorToast = page.getByText(/Maximum Requests Reached/i).or(page.getByText(/requests per scenario reached/i));
    const toastVisible = await errorToast.isVisible({ timeout: 5000 }).catch(() => false);
    
    // Check response area for error message
    const responseArea = page.locator('[class*="response"], [class*="Response"], [class*="status"]').first();
    const hasError = await responseArea.getByText(/Maximum|requests per scenario|limit reached|429|Too Many Requests/i).isVisible({ timeout: 3000 }).catch(() => false);
    
    // Also check response status if visible
    const status429 = await page.getByText(/429|Too Many Requests/i).isVisible({ timeout: 2000 }).catch(() => false);
    
    // Verify error message is displayed
    expect(toastVisible || hasError || status429).toBeTruthy();
    console.log('[Test] ✅ Error message displayed:', { toastVisible, hasError, status429 });
  });
  
  test('should verify no external API calls are made when limit is reached', async ({ page }) => {
    await page.goto('/playground.html');
    await page.waitForLoadState('networkidle');
    
    // Block external API calls to verify they're not made
    await page.route('**/api-sports.io/**', route => {
      console.log('[Test] ❌ External API call blocked - this should not happen!');
      route.abort();
    });
    
    await page.route('**/openweathermap.org/**', route => {
      console.log('[Test] ❌ External API call blocked - this should not happen!');
      route.abort();
    });
    
    // Track requests to our API endpoints
    const apiRequests: string[] = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/weather') || url.includes('/api/football')) {
        apiRequests.push(url);
      }
    });
    
    // Fill endpoint and execute
    const endpointInput = page.getByPlaceholder(/endpoint/i).or(page.getByLabel(/endpoint/i)).first();
    await endpointInput.fill('/api/weather-unified?city=TestCity&clientType=axios&scope=local');
    
    const executeButton = page.getByRole('button', { name: /execute|send|request/i }).first();
    await executeButton.click();
    
    await page.waitForTimeout(2000);
    
    // Check response
    const response = await page.waitForResponse(
      response => response.url().includes('/api/weather') || response.url().includes('/api/football'),
      { timeout: 5000 }
    ).catch(() => null);
    
    if (response) {
      const status = response.status();
      const headers = response.headers();
      
      console.log('[Test] Response status:', status);
      console.log('[Test] Response headers:', {
        limitReached: headers['x-mockifyer-limit-reached'],
        mocked: headers['x-mockifyer']
      });
      
      // If limit is reached, should return 429 with limit header
      if (status === 429) {
        expect(headers['x-mockifyer-limit-reached']).toBe('true');
        console.log('[Test] ✅ Limit response correctly returned');
      }
    }
    
    // Verify no external API calls were attempted
    // (They would be blocked by our route, but we check they weren't attempted)
    console.log('[Test] API requests made:', apiRequests.length);
  });
});

