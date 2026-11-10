// Test: setupMockifyer with memory provider should work in browser
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

const fixtures = [
  {
    request: {
      method: 'GET',
      url: 'https://api.frankfurter.dev/v1/latest',
      headers: {},
      queryParams: {}
    },
    response: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      data: {
        amount: 1.0,
        base: 'USD',
        date: '2024-01-15',
        rates: { EUR: 0.92, GBP: 0.79 }
      }
    },
    timestamp: '2024-01-15T10:00:00.000Z'
  }
];

export function testMemoryProvider() {
  console.log('[Browser Test] Setting up mockifyer with memory provider...');
  
  try {
    const mockifyer = setupMockifyer({
      mockDataPath: './mock-data',
      databaseProvider: {
        type: 'memory',
        options: {}
      },
      recordMode: false,
      failOnMissingMock: true,
      useGlobalFetch: false
    });
    
    console.log('[Browser Test] ✅ setupMockifyer succeeded');
    return { success: true, mockifyer };
  } catch (error: any) {
    console.error('[Browser Test] ❌ setupMockifyer failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Auto-run in browser
if (typeof window !== 'undefined') {
  (window as any).testMemoryProvider = testMemoryProvider;
  const result = testMemoryProvider();
  (window as any).mockifyerTestResult = result;
}
