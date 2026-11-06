# Shared settings for the guide's demo helpers (source it; not part of Mockifyer).
# Run the helpers from anywhere inside the mockifyer monorepo checkout.
REPO="${MOCKIFYER_REPO:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
WW="$REPO/example-projects/wanderweird-travel"
DASH="${MOCKIFYER_DASHBOARD_URL:-http://127.0.0.1:3002}"
SCENARIO="${SCENARIO:-guide-demo-2}"
GW="${GATEWAY_URL:-http://127.0.0.1:4200}"
# find_mock <exact endpoint URL>  -> prints the mock filename (dashboard API: GET /api/mocks?scenario=)
find_mock() { curl -s "$DASH/api/mocks?scenario=$SCENARIO" | node -e '
  const want=process.argv[1]; const j=JSON.parse(require("fs").readFileSync(0));
  for (const f of j.files) if (f.endpoint===want) console.log(f.filename);' "$1"; }
# The recorded Open-Meteo forecast behind "Atlantis Boardwalk" (Athens).
ATHENS_FORECAST='https://api.open-meteo.com/v1/forecast?latitude=37.9838&longitude=23.7275&current=temperature_2m%2Cweather_code%2Cwind_speed_10m&daily=temperature_2m_max%2Ctemperature_2m_min%2Cprecipitation_probability_max&timezone=auto&forecast_days=3'
# Cloud Nine B&B (Lausanne) forecast
CLOUDNINE_PREFIX='https://api.open-meteo.com/v1/forecast?latitude=46.5197'
# pid listening on :4203 (wander-api), via ss (iproute2)
pid4203() { ss -ltnp 2>/dev/null | sed -n 's/.*:4203 .*pid=\([0-9]*\).*/\1/p' | head -1; }
