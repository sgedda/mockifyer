#!/usr/bin/env bash
set -euo pipefail

# Stop/start wander-api (:4203), the only WanderWeird service that calls Open-Meteo.
# The rest of the stack (gateway :4200 etc.) is left running.
#   wander.sh stop              kill the :4203 listener and its tsx-watch parent, wait until the port is closed
#   wander.sh start             start wander-api unpinned (scenario resolved from the client lane)
#   wander.sh start <scenario>  start wander-api pinned via MOCKIFYER_SCENARIO

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WW="${WW:-example-projects/wanderweird-travel}"
if [[ "$WW" = /* ]]; then WW_DIR="$WW"; else WW_DIR="$REPO_ROOT/$WW"; fi

PORT=4203
DASH="${MOCKIFYER_DASHBOARD_URL:-http://127.0.0.1:3002}"
LOG_FILE="${WANDER_LOG_FILE:-/tmp/wander-api.log}"
STOP_WAIT_SECONDS=15
START_WAIT_SECONDS=60

listener_pids() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -t -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true
  else
    ss -ltnpH "sport = :$PORT" 2>/dev/null | grep -oP 'pid=\K[0-9]+' || true
  fi
}

port_open() { [ -n "$(listener_pids)" ]; }

# The listener runs under `tsx watch`; kill the watcher too so it cannot respawn the server.
pids_to_kill() {
  local pid parent
  for pid in $(listener_pids); do
    echo "$pid"
    parent="$(ps -o ppid= -p "$pid" | tr -d ' ')"
    if [ -n "$parent" ] && ps -o args= -p "$parent" | grep -q 'tsx.*watch'; then
      echo "$parent"
    fi
  done
}

stop_wander() {
  local pids
  pids="$(pids_to_kill | sort -u | tr '\n' ' ')"
  if [ -n "${pids// /}" ]; then
    echo "Stopping wander-api (pids $pids)"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
  fi
  for _ in $(seq "$STOP_WAIT_SECONDS"); do
    port_open || { echo "wander-api stopped (:$PORT closed)"; return 0; }
    sleep 1
  done
  pids="$(pids_to_kill | sort -u | tr '\n' ' ')"
  echo "wander-api ignored SIGTERM, sending SIGKILL to $pids"
  # shellcheck disable=SC2086
  kill -9 $pids 2>/dev/null || true
  sleep 1
  if port_open; then
    echo "ERROR: :$PORT still listening after SIGKILL (pids $(listener_pids | tr '\n' ' '))" >&2
    exit 1
  fi
  echo "wander-api stopped (:$PORT closed)"
}

# Same Mockifyer env as the root `dev:proxy:record` script the workflow starts the stack with.
start_wander() {
  local scenario="${1:-}"
  port_open && stop_wander
  cd "$WW_DIR"
  if [ -n "$scenario" ]; then
    echo "Starting wander-api pinned to $scenario"
  else
    echo "Starting wander-api unpinned (follows client lane)"
  fi
  env ${scenario:+MOCKIFYER_SCENARIO="$scenario"} \
    MOCKIFYER_RUNTIME=proxy MOCKIFYER_PROXY_URL="$DASH" \
    MOCKIFYER_ACTIVATION_MODE=client_id_header MOCKIFYER_RECORD=true MOCKIFYER_RECORD_RESPONSES=false \
    setsid nohup npm run dev -w @wanderweird/wander-api > "$LOG_FILE" 2>&1 < /dev/null &
  for _ in $(seq "$START_WAIT_SECONDS"); do
    port_open && { echo "wander-api up on :$PORT"; return 0; }
    sleep 1
  done
  echo "ERROR: wander-api did not open :$PORT within ${START_WAIT_SECONDS}s" >&2
  tail -50 "$LOG_FILE" >&2 || true
  exit 1
}

case "${1:-}" in
  stop) stop_wander ;;
  start) start_wander "${2:-}" ;;
  *) echo "Usage: $0 {stop|start [scenario]}" >&2; exit 2 ;;
esac
