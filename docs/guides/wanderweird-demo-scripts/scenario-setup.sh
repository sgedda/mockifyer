#!/bin/bash
# Creates demo scenarios "heatwave" and "rainy-weekend" derived from $SCENARIO (guide-demo-2) and gives the
# Athens (Atlantis Boardwalk) forecast different values in each. Not part of Mockifyer; Mockifyer APIs used:
#   POST /api/scenario-config/create {scenario, deriveFrom}   (copies mocks; derived mocks start on live API)
#   GET  /api/mocks?scenario=…  and  GET /api/mocks/<file>?scenario=…
#   PUT  /api/mocks/<file>?scenario=… {responseData}  then  {replayMode:"stored"} ("Use saved mock")
#   POST /api/scenario-config/set {scenario}  (create also switches the global scenario; this puts it back)
. "$(dirname "$0")/common.sh"
mk() { # name temperature_2m wind_speed_10m weather_code
  curl -s -X POST "$DASH/api/scenario-config/create" -H 'content-type: application/json' \
    -d "{\"scenario\":\"$1\",\"deriveFrom\":\"$SCENARIO\"}" | node -e 'const j=JSON.parse(require("fs").readFileSync(0));console.log(j.message||j.error)'
  F=$(SCENARIO=$1 find_mock "$ATHENS_FORECAST")
  curl -s "$DASH/api/mocks/$F?scenario=$1" | node -e '
    const r=JSON.parse(require("fs").readFileSync(0)).data.response.data;
    Object.assign(r.current,{temperature_2m:+process.argv[1],wind_speed_10m:+process.argv[2],weather_code:+process.argv[3]});
    console.log(JSON.stringify({responseData:r}))' "$2" "$3" "$4" |
    curl -s -o /dev/null -w "  $1 forecast edit -> %{http_code}\n" -X PUT "$DASH/api/mocks/$F?scenario=$1" -H 'content-type: application/json' -d @-
  curl -s -o /dev/null -w "  $1 replayMode stored -> %{http_code}\n" -X PUT "$DASH/api/mocks/$F?scenario=$1" -H 'content-type: application/json' -d '{"replayMode":"stored"}'
}
mk heatwave 44 3 0
mk rainy-weekend 11 52 63
curl -s -o /dev/null -X POST "$DASH/api/scenario-config/set" -H 'content-type: application/json' -d "{\"scenario\":\"$SCENARIO\"}"
echo "global scenario back to $SCENARIO"
