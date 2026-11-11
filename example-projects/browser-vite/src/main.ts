import { setupMockifyer } from '@sgedda/mockifyer-fetch'
import { currencyRatesFixture } from './fixtures'

// Setup Mockifyer with memory provider and preloaded fixtures
setupMockifyer({
  mockDataPath: './mock-data',  // Required but not used with memory provider
  databaseProvider: {
    type: 'memory',
    options: {
      fixtures: [currencyRatesFixture]
    }
  },
  recordMode: false,
  failOnMissingMock: false,  // Allow unmocked requests to pass through
  useGlobalFetch: true        // Patch global fetch
})

console.log('[Mockifyer] Initialized with memory provider')

// Helper to update UI
function updateCard(prefix: string, status: string, data: any, isError = false) {
  const statusEl = document.getElementById(`${prefix}-status`)
  const dataEl = document.getElementById(`${prefix}-data`)
  const badgeEl = document.getElementById(`${prefix}-badge`)
  
  if (statusEl) statusEl.textContent = status
  if (dataEl) {
    dataEl.className = 'data'
    dataEl.textContent = JSON.stringify(data, null, 2)
  }
  if (isError && badgeEl) {
    badgeEl.className = 'badge badge-error'
    badgeEl.textContent = 'ERROR'
  }
}

// Test mocked request (has preloaded fixture)
async function testMockedRequest() {
  try {
    console.log('[Mockifyer] Fetching mocked request...')
    const response = await fetch('https://api.frankfurter.dev/v1/latest')
    const data = await response.json()
    
    console.log('[Mockifyer] Mocked response:', data)
    updateCard('mocked', `Status: ${response.status} (from fixture)`, data)
  } catch (error: any) {
    console.error('[Mockifyer] Mocked request failed:', error)
    updateCard('mocked', 'Error', { error: error.message }, true)
  }
}

// Test unmocked request (no fixture, goes to network)
async function testLiveRequest() {
  try {
    console.log('[Mockifyer] Fetching live request...')
    // Use localhost test server in test mode, real API otherwise
    const testMode = new URLSearchParams(window.location.search).get('test') === 'true'
    const url = testMode ? 'http://localhost:8765/test-api' : 'https://api.ipify.org?format=json'
    
    const response = await fetch(url)
    const data = await response.json()
    
    console.log('[Mockifyer] Live response:', data)
    updateCard('live', `Status: ${response.status} (from network)`, data)
  } catch (error: any) {
    console.error('[Mockifyer] Live request failed:', error)
    updateCard('live', 'Error', { error: error.message }, true)
  }
}

// Run both tests on load
Promise.all([
  testMockedRequest(),
  testLiveRequest()
]).then(() => {
  console.log('[Mockifyer] All requests complete')
})
