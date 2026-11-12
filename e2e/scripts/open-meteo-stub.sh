#!/usr/bin/env bash
set -euo pipefail

# Start/stop the Open-Meteo stub server for e2e tests.
#   open-meteo-stub.sh start   start on :9100, wait for health
#   open-meteo-stub.sh stop    stop it and wait until the port is closed
# Env: OPEN_METEO_STUB_PORT (default 9100)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${OPEN_METEO_STUB_PORT:-9100}"
LOG_FILE=/tmp/open-meteo-stub.log
START_WAIT_SECONDS=30
STOP_WAIT_SECONDS=15

# shellcheck source=port-lib.sh
source "$SCRIPT_DIR/port-lib.sh"

stop_stub() {
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
  echo "Open-Meteo stub stopped (:$PORT closed)"
}

start_stub() {
  port_open && stop_stub
  setsid nohup tsx "$SCRIPT_DIR/open-meteo-stub.ts" "$PORT" > "$LOG_FILE" 2>&1 < /dev/null &
  for _ in $(seq "$START_WAIT_SECONDS"); do
    curl -sf "http://127.0.0.1:$PORT/v1/forecast?latitude=37.9838&longitude=23.7275&current=temperature_2m&timezone=auto&forecast_days=1" >/dev/null 2>&1 && {
      echo "Open-Meteo stub up on :$PORT"
      return 0
    }
    sleep 1
  done
  echo "ERROR: Open-Meteo stub did not respond on :$PORT within ${START_WAIT_SECONDS}s" >&2
  tail -50 "$LOG_FILE" >&2 || true
  exit 1
}

case "${1:-}" in
  start) start_stub ;;
  stop) stop_stub ;;
  *) echo "Usage: $0 {start|stop}" >&2; exit 2 ;;
esac
