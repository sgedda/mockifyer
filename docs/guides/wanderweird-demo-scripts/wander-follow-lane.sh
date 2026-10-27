#!/bin/bash
# Restarts wander-api (:4203) WITHOUT MOCKIFYER_SCENARIO so the dashboard picks its scenario from the
# wanderweird-demo client lane (a pinned MOCKIFYER_SCENARIO is a body override and always wins).
# Not part of Mockifyer. Usage:  scripts/wander-follow-lane.sh                 (follow the lane)
#                                PIN=guide-demo-2 scripts/wander-follow-lane.sh (pinned again, like start-stack.sh)
. "$(dirname "$0")/common.sh"; cd "$WW/services/wander-api" || exit 1
P=$(pid4203); [ -n "$P" ] && kill "$P"
for i in $(seq 10); do [ -z "$(pid4203)" ] && break; sleep 1; done
env ${PIN:+MOCKIFYER_SCENARIO=$PIN} MOCKIFYER_RUNTIME=proxy MOCKIFYER_PROXY_URL=$DASH MOCKIFYER_DASHBOARD_URL=$DASH \
  MOCKIFYER_ACTIVATION_MODE=always MOCKIFYER_RECORD=true MOCKIFYER_RECORD_RESPONSES=true \
  MOCKIFYER_PATH=../../mock-data MOCKIFYER_CLIENT_ID=wanderweird-demo \
  nohup npx tsx watch src/server.ts > "$WW/logs/wander-api.log" 2>&1 &
for i in $(seq 30); do [ -n "$(pid4203)" ] && break; sleep 1; done
echo "wander-api :4203 $([ -n "$(pid4203)" ] && echo up || echo DOWN), scenario ${PIN:-from client lane}"
