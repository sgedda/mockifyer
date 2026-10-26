#!/bin/bash
# Restart wander-api (tsx watch reruns on file touch) and set the /discover mocks back to "Always use live API".
. "$(dirname "$0")/common.sh"
[ -n "$(pid4203)" ] || touch "$WW/services/wander-api/src/server.ts"
for i in $(seq 20); do [ -n "$(pid4203)" ] && break; sleep 1; done
for f in $(find_mock 'http://127.0.0.1:4203/discover?destinationKey=atlantis') $(find_mock 'http://127.0.0.1:4203/discover'); do
  curl -s -o /dev/null -X PUT -H 'content-type: application/json' "$DASH/api/mocks/$f?scenario=$SCENARIO" -d '{"replayMode":"passthrough"}'; done
echo "wander-api up; mocks back to live API; discover -> $(curl -s -o /dev/null -w '%{http_code}' "$GW/api/discover?destinationKey=atlantis")"
