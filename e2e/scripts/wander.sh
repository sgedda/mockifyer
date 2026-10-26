#!/bin/bash
# Stop/start wander-api (:4203), the only WanderWeird service that calls Open-Meteo.
# Same env as the guide's wander-follow-lane.sh / start-stack.sh.
#   scripts/wander.sh stop                 kill the process listening on :4203 (and its tsx-watch parent)
#   scripts/wander.sh start [SCENARIO]     start it; with SCENARIO it is pinned via MOCKIFYER_SCENARIO,
#                                          without it the dashboard resolves the scenario from the client lane
set -u
HERE="$(cd "$(dirname "$0")" && pwd)"
WW="${WW:-$HERE/../../example-projects/wanderweird-travel}"
DASH="${MOCKIFYER_DASHBOARD_URL:-http://127.0.0.1:3002}"
pid4203() { ss -ltnp 2>/dev/null | grep -oP ':4203 .*pid=\K[0-9]+' | head -1; }
stop() {
  local p; p=$(pid4203)
  if [ -n "$p" ]; then
    local parent; parent=$(ps -o ppid= -p "$p" | tr -d ' ')
    # only kill the parent when it is a tsx watcher, so the server is not respawned behind our back
    if [ -n "$parent" ] && ps -o args= -p "$parent" | grep -q "tsx.*watch"; then kill "$parent" 2>/dev/null; fi
    kill "$p" 2>/dev/null
  fi
  for _ in $(seq 15); do [ -z "$(pid4203)" ] && break; sleep 1; done
  [ -z "$(pid4203)" ] && echo "wander-api stopped" || { echo "wander-api still up"; exit 1; }
}
start() {
  [ -n "$(pid4203)" ] && stop >/dev/null
  cd "$WW/services/wander-api" || exit 1
  env ${1:+MOCKIFYER_SCENARIO=$1} MOCKIFYER_RUNTIME=proxy MOCKIFYER_PROXY_URL="$DASH" \
    MOCKIFYER_DASHBOARD_URL="$DASH" MOCKIFYER_ACTIVATION_MODE=always MOCKIFYER_RECORD=true \
    MOCKIFYER_RECORD_RESPONSES=true MOCKIFYER_PATH=../../mock-data MOCKIFYER_CLIENT_ID=wanderweird-demo \
    MOCKIFYER_METRO_URL=http://localhost:8090 setsid npx tsx watch src/server.ts > /tmp/wander-api.log 2>&1 < /dev/null &
  for _ in $(seq 40); do [ -n "$(pid4203)" ] && break; sleep 1; done
  [ -n "$(pid4203)" ] && echo "wander-api up (scenario: ${1:-from client lane})" || { echo "wander-api DOWN"; exit 1; }
}
case "${1:-}" in stop) stop ;; start) start "${2:-}" ;; *) echo "usage: $0 stop|start [SCENARIO]"; exit 2 ;; esac
