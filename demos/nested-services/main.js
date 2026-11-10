const GATEWAY_URL = 'http://localhost:3001';
const DASHBOARD_URL = 'http://localhost:3002';

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
  
  elements.loading.style.display = 'block';
  elements.error.style.display = 'none';
  elements.result.classList.remove('show');
  elements.fetchButton.disabled = true;
  
  try {
    const response = await fetch(`${GATEWAY_URL}/api/trip/${encodeURIComponent(city)}`);
    
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
    elements.loading.style.display = 'none';
    elements.fetchButton.disabled = false;
  }
}

function displayResults(data) {
  document.getElementById('city').textContent = data.city;
  document.getElementById('country').textContent = data.location?.country || 'N/A';
  document.getElementById('region').textContent = data.location?.region || 'N/A';
  document.getElementById('population').textContent = 
    data.location?.population?.toLocaleString() || 'N/A';
  
  const temp = data.weather?.temperature;
  document.getElementById('temperature').textContent = 
    temp ? `${(temp - 273.15).toFixed(1)}°C` : 'N/A';
  document.getElementById('conditions').textContent = 
    data.weather?.description || 'N/A';
  document.getElementById('humidity').textContent = 
    data.weather?.humidity ? `${data.weather.humidity}%` : 'N/A';
  
  document.getElementById('currencyName').textContent = 
    data.currency?.name || 'N/A';
  document.getElementById('currencyCode').textContent = 
    data.currency?.code || 'N/A';
  document.getElementById('exchangeRate').textContent = 
    data.currency?.exchangeRate || 'N/A';
  
  document.getElementById('hopCount').textContent = 
    `${data._meta?.hops || 0} hops`;
  document.getElementById('traceId').textContent = 
    data.requestId || 'N/A';
  document.getElementById('timestamp').textContent = 
    data.timestamp || 'N/A';
  
  elements.result.classList.add('show');
}

function showError(message) {
  elements.error.textContent = `Error: ${message}`;
  elements.error.style.display = 'block';
  elements.result.classList.remove('show');
}

async function switchScenario() {
  const scenario = elements.scenarioSelect.value;
  elements.switchScenarioButton.disabled = true;
  
  try {
    const response = await fetch(`${DASHBOARD_URL}/api/scenario-config/active-scenario`, {
      method: 'PUT',
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
  fetchTripInfo();
});
