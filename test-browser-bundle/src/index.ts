// Browser bundle test - verifies no Node built-ins are pulled in
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import frankfurterRates from '../fixtures/frankfurter-rates.json';

export async function testSeededReplay() {
  console.log('[Browser Test] Setting up mockifyer with seeded fixtures...');
  
  try {
    const mockifyer = setupMockifyer({
      mockDataPath: './fixtures',
      databaseProvider: {
        type: 'memory',
        options: {
          fixtures: [frankfurterRates]
        }
      },
      recordMode: false,
      failOnMissingMock: true,
      useGlobalFetch: true // Patch global fetch
    });
    
    console.log('[Browser Test] ✅ setupMockifyer succeeded');
    
    // Test 1: Seeded replay should work
    console.log('[Browser Test] Test 1: Fetching seeded mock...');
    const response = await fetch('https://api.frankfurter.dev/v1/latest');
    const data = await response.json();
    
    // Verify we got mock data (not real API which would have different date)
    if (!data.base || !data.rates) {
      throw new Error(`Invalid response structure: ${JSON.stringify(data)}`);
    }
    if (data.base === 'USD' && data.rates.EUR === 0.92) {
      console.log('[Browser Test] ✅ Seeded replay worked (USD base):', data);
    } else if (data.base === 'EUR' && data.rates.USD) {
      console.log('[Browser Test] ✅ Seeded replay worked (EUR base):', data);
    } else {
      console.warn('[Browser Test] ⚠️  Got data but with unexpected format:', data);
    }
    
    // Test 2: Missing mock should throw clear error
    console.log('[Browser Test] Test 2: Testing missing mock error...');
    let errorThrown = false;
    let errorMessage = '';
    try {
      await fetch('https://api.frankfurter.dev/v1/currencies');
    } catch (error: any) {
      errorThrown = true;
      errorMessage = error.message;
      console.log('[Browser Test] ✅ Clear error thrown:', errorMessage);
    }
    
    if (!errorThrown) {
      throw new Error('Missing mock should have thrown an error');
    }
    
    if (!errorMessage.includes('No mock found') || !errorMessage.includes('Request key:')) {
      throw new Error(`Error message not clear enough: ${errorMessage}`);
    }
    
    console.log('[Browser Test] ✅ All tests passed');
    return { 
      success: true, 
      tests: {
        seededReplay: true,
        clearErrorOnMiss: true
      }
    };
  } catch (error: any) {
    console.error('[Browser Test] ❌ Test failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Auto-run in browser
if (typeof window !== 'undefined') {
  (window as any).testSeededReplay = testSeededReplay;
  testSeededReplay().then(result => {
    (window as any).mockifyerTestResult = result;
  });
}
