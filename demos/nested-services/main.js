// Compute dashboard URL for WebContainer or local development
function getDashboardUrl() {
  const hostname = window.location.hostname;
  
  // StackBlitz WebContainer: *.webcontainer.io
  // Port pattern: project-5173.webcontainer.io → project-3002.webcontainer.io
  if (hostname.includes('.webcontainer.io')) {
    // Replace the port number in the hostname
    const dashboardHost = hostname.replace(/-\d+\.webcontainer\.io/, '-3002.webcontainer.io');
    return `https://${dashboardHost}`;
  }
  
  // Other cloud IDEs
  if (hostname.includes('stackblitz') || hostname.includes('gitpod') || hostname.includes('codespaces')) {
    const protocol = window.location.protocol;
    return `${protocol}//${hostname.replace(/:\d+/, '')}:3002`;
  }
  
  // Local development
  return 'http://localhost:3002';
}

// Gateway is proxied through Vite, so use relative URL
const GATEWAY_URL = '';  // Empty string means relative to current origin
const DASHBOARD_URL = getDashboardUrl();

const elements = {
  cityInput: document.getElementById('cityInput'),
  fetchButton: document.getElementById('fetchButton'),
  scenarioSelect: document.getElementById('scenarioSelect'),
  switchScenarioButton: document.getElementById('switchScenarioButton'),
  loading: document.getElementById('loading'),
  error: document.getElementById('error'),
  result: document.getElementById('result')
};

async function fetchTripInfo() {
  const city = elements.cityInput.value.trim();
  
  if (!city) {
    showError('Please enter a city name');
    return;
  }
  
  elements.loading.classList.remove('hidden');
  elements.error.classList.add('hidden');
  elements.result.classList.add('hidden');
  elements.fetchButton.disabled = true;
  
  try {
    // Get current scenario from selector
    const scenario = elements.scenarioSelect.value;
    // Use relative URL - Vite proxies /api to gateway on port 3001
    const url = `/api/trip/${encodeURIComponent(city)}?scenario=${encodeURIComponent(scenario)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(errorData.message || `Request failed: ${response.status}`);
    }
    
    const data = await response.json();
    displayResults(data);
    
  } catch (err) {
    console.error('Fetch error:', err);
    showError(err.message);
  } finally {
    elements.loading.classList.add('hidden');
    elements.fetchButton.disabled = false;
  }
}

function displayResults(data) {
  // Weather
  if (data.weather?.error) {
    document.getElementById('temperature').textContent = 'Error';
    document.getElementById('condition').textContent = data.weather.error;
    document.getElementById('humidity').textContent = 'N/A';
  } else {
    document.getElementById('temperature').textContent = 
      data.weather?.temperature ? `${data.weather.temperature}°C` : 'N/A';
    document.getElementById('condition').textContent = 
      data.weather?.condition || 'N/A';
    document.getElementById('humidity').textContent = 
      data.weather?.humidity ? `${data.weather.humidity}%` : 'N/A';
  }
  
  // Reviews
  if (data.reviews?.error) {
    document.getElementById('reviewCount').textContent = '0 (Error)';
    document.getElementById('reviews').innerHTML = `<p style="color: #c00;">${data.reviews.error}</p>`;
  } else {
    document.getElementById('reviewCount').textContent = data.reviews?.count || 0;
    const reviewsHtml = (data.reviews?.latest || []).map(r => 
      `<p style="margin: 4px 0;">• ${r.name}</p>`
    ).join('');
    document.getElementById('reviews').innerHTML = reviewsHtml || '<p>No reviews</p>';
  }
  
  // Currency
  if (data.currency?.error) {
    document.getElementById('currencyRate').textContent = 'Error';
  } else {
    const rate = data.currency?.rate;
    const from = data.currency?.from || 'USD';
    const to = data.currency?.to || 'EUR';
    document.getElementById('currencyRate').textContent = 
      rate ? `1 ${from} = ${rate} ${to}` : 'N/A';
  }
  
  document.getElementById('timestamp').textContent = 
    data.timestamp?.split('T')[0] || 'N/A';
  
  document.getElementById('apiCount').textContent = 
    `${data._meta?.totalApiCalls || 0} API calls`;
  document.getElementById('traceId').textContent = 
    data.requestId || 'N/A';
  
  elements.result.classList.remove('hidden');
}

function showError(message) {
  elements.error.textContent = `Error: ${message}`;
  elements.error.classList.remove('hidden');
  elements.result.classList.add('hidden');
}

async function switchScenario() {
  const scenario = elements.scenarioSelect.value;
  elements.switchScenarioButton.disabled = true;
  
  try {
    const response = await fetch(`${DASHBOARD_URL}/api/scenario-config/set`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ scenario })
    });
    
    if (!response.ok) {
      throw new Error('Failed to switch scenario');
    }
    
    alert(`✓ Switched to scenario: ${scenario}`);
    
    // Auto-fetch again with the new scenario
    if (elements.cityInput.value.trim()) {
      setTimeout(() => fetchTripInfo(), 500);
    }
    
  } catch (err) {
    console.error('Scenario switch error:', err);
    alert(`Failed to switch scenario: ${err.message}`);
  } finally {
    elements.switchScenarioButton.disabled = false;
  }
}

// Event listeners
elements.fetchButton.addEventListener('click', fetchTripInfo);
elements.switchScenarioButton.addEventListener('click', switchScenario);
elements.cityInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    fetchTripInfo();
  }
});

// Auto-fetch on load
window.addEventListener('load', () => {
  // Set dashboard links
  document.getElementById('dashboardLink').href = DASHBOARD_URL;
  document.getElementById('traceLink').href = `${DASHBOARD_URL}/#/network-events`;
  document.getElementById('mocksLink').href = `${DASHBOARD_URL}/#/mocks`;
  
  fetchTripInfo();
});
