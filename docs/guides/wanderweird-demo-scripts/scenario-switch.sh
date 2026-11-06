#!/bin/bash
# scripts/scenario-switch.sh <scenario>  — same as picking it in Settings → Client lanes for wanderweird-demo.
# Mockifyer API: PUT /api/client-lanes/wanderweird-demo/scenario {scenario}. Then prints what the app's
# Discover call now returns for Atlantis (gateway GET /api/discover?destinationKey=atlantis).
. "$(dirname "$0")/common.sh"; S=${1:?scenario}
curl -s -o /dev/null -w "lane wanderweird-demo -> $S (%{http_code})\n" -X PUT "$DASH/api/client-lanes/wanderweird-demo/scenario" -H 'content-type: application/json' -d "{\"scenario\":\"$S\"}"
curl -s -m15 "$GW/api/discover?destinationKey=atlantis" | node -e 'const c=JSON.parse(require("fs").readFileSync(0)).weather.current;console.log(`Atlantis: ${c.temperature_2m}° wind ${c.wind_speed_10m}`)'
