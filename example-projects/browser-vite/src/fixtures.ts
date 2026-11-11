// Preloaded fixture for the mocked request
export const currencyRatesFixture = {
  "request": {
    "method": "GET",
    "url": "https://api.frankfurter.dev/v1/latest"
  },
  "response": {
    "status": 200,
    "data": {
      "amount": 1,
      "base": "USD",
      "date": "2024-01-15",
      "rates": {
        "EUR": 0.92,
        "GBP": 0.79,
        "JPY": 149.50
      }
    },
    "headers": {
      "content-type": "application/json"
    }
  },
  "timestamp": "2024-01-15T10:00:00.000Z"
}
