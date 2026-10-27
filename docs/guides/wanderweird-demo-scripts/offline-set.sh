#!/bin/bash
# Offline demo: wander-api /discover mocks -> "Use saved mock", record their bodies, then stop wander-api.
# Mockifyer API used: PUT /api/mocks/<file>?scenario=  {"replayMode":"refresh-next"}
. "$(dirname "$0")/common.sh"
FILES="$(find_mock 'http://127.0.0.1:4203/discover?destinationKey=atlantis') $(find_mock 'http://127.0.0.1:4203/discover')"
for f in $FILES; do curl -s -o /dev/null -X PUT -H 'content-type: application/json' "$DASH/api/mocks/$f?scenario=$SCENARIO" -d '{"replayMode":"refresh-next"}'; done
curl -s -o /dev/null "$GW/api/discover?destinationKey=atlantis"; curl -s -o /dev/null "$GW/api/discover"   # one live call each records the body
pid=$(pid4203); [ -n "$pid" ] && kill $pid; sleep 1
echo "wander-api stopped; gateway discover from mock -> $(curl -s -o /dev/null -w '%{http_code}' "$GW/api/discover?destinationKey=atlantis")"
