#!/usr/bin/env bash
set -euo pipefail

# Stop/start one WanderWeird service of the running demo stack; the other services keep running.
#   ww-service.sh <service> stop              kill the listener and its tsx-watch parent, wait until the port is closed
#   ww-service.sh <service> start             start it unpinned (scenario resolved from the client lane)
#   ww-service.sh <service> start <scenario>  start it pinned via MOCKIFYER_SCENARIO
# Services: wander-api (:4203, calls Open-Meteo), gateway-api (:4200, calls wander-api and the rest).
# Env: MOCKIFYER_DASHBOARD_URL  dashboard the proxy runtime talks to (default http://127.0.0.1:3002)
#      WW_RECORD=off            omit MOCKIFYER_RECORD / MOCKIFYER_RECORD_RESPONSES, so the dashboard's own
#                               Record switch and domain-path rules decide what is stored

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WW="${WW:-example-projects/wanderweird-travel}"
if [[ "$WW" = /* ]]; then WW_DIR="$WW"; else WW_DIR="$REPO_ROOT/$WW"; fi

SERVICE="${1:-}"
case "$SERVICE" in
  wander-api) PORT=4203 ;;
  gateway-api) PORT=4200 ;;
  *) echo "Usage: $0 {wander-api|gateway-api} {stop|start [scenario]}" >&2; exit 2 ;;
esac
shift
DASH="${MOCKIFYER_DASHBOARD_URL:-http://127.0.0.1:3002}"
LOG_FILE="/tmp/${SERVICE}.log"
STOP_WAIT_SECONDS=15
START_WAIT_SECONDS=60

# shellcheck source=port-lib.sh
source "$SCRIPT_DIR/port-lib.sh"

stop_service() {
  local pids
  pids="$(pids_to_kill | sort -u | tr '\n' ' ')"
  if [ -n "${pids// /}" ]; then
    echo "Stopping $SERVICE (pids $pids)"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
  fi
  for _ in $(seq "$STOP_WAIT_SECONDS"); do
    port_open || { echo "$SERVICE stopped (:$PORT closed)"; return 0; }
    sleep 1
  done
  pids="$(pids_to_kill | sort -u | tr '\n' ' ')"
  echo "$SERVICE ignored SIGTERM, sending SIGKILL to $pids"
  # shellcheck disable=SC2086
  kill -9 $pids 2>/dev/null || true
  sleep 1
  if port_open; then
    echo "ERROR: :$PORT still listening after SIGKILL (pids $(listener_pids | tr '\n' ' '))" >&2
    exit 1
  fi
  echo "$SERVICE stopped (:$PORT closed)"
}

# Same Mockifyer env as the root `dev:proxy:record` script the workflow starts the stack with.
start_service() {
  local scenario="${1:-}"
  local record_env=(MOCKIFYER_RECORD=true MOCKIFYER_RECORD_RESPONSES=false)
  [ "${WW_RECORD:-on}" = off ] && record_env=(-u MOCKIFYER_RECORD -u MOCKIFYER_RECORD_RESPONSES)
  port_open && stop_service
  cd "$WW_DIR"
  local mode="unpinned (follows client lane)"
  [ -n "$scenario" ] && mode="pinned to $scenario"
  echo "Starting $SERVICE $mode via $DASH${WW_RECORD:+, record env $WW_RECORD}"
  env ${scenario:+MOCKIFYER_SCENARIO="$scenario"} \
    MOCKIFYER_RUNTIME=proxy MOCKIFYER_PROXY_URL="$DASH" MOCKIFYER_ACTIVATION_MODE=client_id_header \
    "${record_env[@]}" \
    setsid nohup npm run dev -w "@wanderweird/$SERVICE" > "$LOG_FILE" 2>&1 < /dev/null &
  for _ in $(seq "$START_WAIT_SECONDS"); do
    port_open && { echo "$SERVICE up on :$PORT"; return 0; }
    sleep 1
  done
  echo "ERROR: $SERVICE did not open :$PORT within ${START_WAIT_SECONDS}s" >&2
  tail -50 "$LOG_FILE" >&2 || true
  exit 1
}

case "${1:-}" in
  stop) stop_service ;;
  start) start_service "${2:-}" ;;
  *) echo "Usage: $0 $SERVICE {stop|start [scenario]}" >&2; exit 2 ;;
esac
