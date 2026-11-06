#!/usr/bin/env bash
set -euo pipefail

# A throw-away, EMPTY Mockifyer dashboard (branch build) for the from-scratch GUI test.
# No scenarios besides the built-in ones, no mocks, no lanes, no record env.
#   scratch-dashboard.sh start   wipe the data dir, start on :3022, wait for /api/health
#   scratch-dashboard.sh stop    stop it and delete the data dir
# Env: SCRATCH_DASHBOARD_PORT (default 3022), SCRATCH_DASHBOARD_DATA (default /tmp/mockifyer-scratch-data)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PORT="${SCRATCH_DASHBOARD_PORT:-3022}"
DATA_DIR="${SCRATCH_DASHBOARD_DATA:-/tmp/mockifyer-scratch-data}"
LOG_FILE=/tmp/scratch-dashboard.log
START_WAIT_SECONDS=60
STOP_WAIT_SECONDS=15

# shellcheck source=port-lib.sh
source "$SCRIPT_DIR/port-lib.sh"

stop_dashboard() {
  local pids
  pids="$(listener_pids | tr '\n' ' ')"
  # shellcheck disable=SC2086
  [ -n "${pids// /}" ] && kill $pids 2>/dev/null || true
  for _ in $(seq "$STOP_WAIT_SECONDS"); do
    port_open || break
    sleep 1
  done
  # shellcheck disable=SC2046
  port_open && kill -9 $(listener_pids) 2>/dev/null || true
  rm -rf "$DATA_DIR"
  echo "scratch dashboard stopped (:$PORT closed, $DATA_DIR removed)"
}

start_dashboard() {
  stop_dashboard
  mkdir -p "$DATA_DIR"
  setsid nohup node "$REPO_ROOT/packages/mockifyer-dashboard/bin/mockifyer-dashboard" \
    --provider sqlite --path "$DATA_DIR" --port "$PORT" --host 127.0.0.1 > "$LOG_FILE" 2>&1 < /dev/null &
  for _ in $(seq "$START_WAIT_SECONDS"); do
    curl -sf "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1 && { echo "scratch dashboard up on :$PORT (empty, $DATA_DIR)"; return 0; }
    sleep 1
  done
  echo "ERROR: scratch dashboard did not answer on :$PORT within ${START_WAIT_SECONDS}s" >&2
  tail -50 "$LOG_FILE" >&2 || true
  exit 1
}

case "${1:-}" in
  start) start_dashboard ;;
  stop) stop_dashboard ;;
  *) echo "Usage: $0 {start|stop}" >&2; exit 2 ;;
esac
