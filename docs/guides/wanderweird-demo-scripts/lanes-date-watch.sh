#!/bin/bash
# Same scenario (guide-demo-2), two client lanes, each with its own Mockifyer "now".
# A = app stack graphql-api :4206 (client wanderweird-demo); B = graphql-api :4216 (client teammate-b)
now(){ timeout 5 curl -s "${MOCKIFYER_DASHBOARD_URL:-http://127.0.0.1:3002}/api/date-config?clientId=$1" | grep -o '"currentDate":"[^"]*' | cut -d'"' -f4 | cut -c1-10; }
src(){ timeout 5 curl -s "${MOCKIFYER_DASHBOARD_URL:-http://127.0.0.1:3002}/api/date-config?clientId=$1" | grep -o '"configSource":"[^"]*' | cut -d'"' -f4; }
hl(){ timeout 15 curl -s localhost:$1/graphql -H 'content-type: application/json' -d '{"query":"{ travelerDashboard(userId:\"u-wanderer\"){ headline } }"}' | grep -o '"headline":"[^"]*' | cut -d'"' -f4; }
while true; do
  clear; printf '\033[1mMockifyer date per client lane · scenario guide-demo-2\033[0m\n\n'
  printf '  client A  wanderweird-demo  now %s (%s)\n            %s\n\n' "$(now wanderweird-demo)" "$(src wanderweird-demo)" "$(hl 4206)"
  printf '  client B  teammate-b        now %s (%s)\n            %s\n' "$(now teammate-b)" "$(src teammate-b)" "$(hl 4216)"
  printf '\n\033[2m%s (Lisbon)\033[0m\n' "$(date +%H:%M:%S)"; sleep 3
done
