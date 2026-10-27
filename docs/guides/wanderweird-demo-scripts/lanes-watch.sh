#!/bin/bash
# Two Mockifyer clients asking for the same Athens forecast through the dashboard proxy.
# A = app stack wander-api :4203 (client id wanderweird-demo, scenario pinned by MOCKIFYER_SCENARIO)
# B = second wander-api :4213 (client id teammate-b, scenario from its client lane)
t(){ timeout 15 curl -s "http://127.0.0.1:$1/discover?destinationKey=atlantis" | grep -o '"temperature_2m":[0-9.]*' | head -1 | cut -d: -f2; }
lane(){ timeout 5 curl -s ${MOCKIFYER_DASHBOARD_URL:-http://127.0.0.1:3002}/api/client-lanes | grep -o "\"clientId\":\"$1\",\"scenario\":\"[^\"]*\"" | cut -d'"' -f8; }
while true; do
  clear; printf '\033[1mAthens forecast, current temperature (served via Mockifyer proxy)\033[0m\n\n'
  printf '  client A  wanderweird-demo  scenario %-14s  %s°C\n' "guide-demo-2" "$(t 4203)"
  printf '  client B  teammate-b        scenario %-14s  %s°C\n' "$(lane teammate-b)" "$(t 4213)"
  printf '\n\033[2m%s (Lisbon)\033[0m\n' "$(date +%H:%M:%S)"; sleep 3
done
