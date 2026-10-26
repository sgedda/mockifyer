#!/usr/bin/env bash
set -euo pipefail

# Manage WanderWeird services (gateway + wander-api)
# Usage:
#   wander.sh stop              - stop all services
#   wander.sh start             - start unpinned (follows lane)
#   wander.sh start <scenario>  - start pinned to scenario

# Resolve repo root from script location (e2e/scripts/wander.sh -> repo root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Resolve WW_DIR: if relative, make it relative to REPO_ROOT
if [ -n "${WW:-}" ]; then
  # If WW doesn't start with /, it's relative - resolve against REPO_ROOT
  if [[ ! "$WW" = /* ]]; then
    WW_DIR="$REPO_ROOT/$WW"
  else
    WW_DIR="$WW"
  fi
else
  # Default to WanderWeird location in monorepo
  WW_DIR="$REPO_ROOT/example-projects/wanderweird-travel"
fi

LOG_FILE="${LOG_FILE:-/tmp/services.log}"
PID_FILE="/tmp/wander-services.pid"

stop_services() {
  if [ -f "$PID_FILE" ]; then
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping services (PID $pid)..."
      kill "$pid" 2>/dev/null || true
      sleep 2
      kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
  
  # Also kill any lingering processes
  pkill -f 'dev:proxy:record' 2>/dev/null || true
  sleep 1
}

start_services() {
  local scenario="${1:-}"
  
  cd "$WW_DIR"
  
  echo "Starting WanderWeird services..."
  if [ -n "$scenario" ]; then
    echo "  Pinned to scenario: $scenario"
    MOCKIFYER_SCENARIO="$scenario" nohup npm run dev:proxy:record > "$LOG_FILE" 2>&1 &
  else
    echo "  Unpinned (follows client lane)"
    nohup npm run dev:proxy:record > "$LOG_FILE" 2>&1 &
  fi
  
  pid=$!
  echo $pid > "$PID_FILE"
  echo "Services started (PID $pid)"
  
  # Wait for services to be ready
  npx wait-on -t 60000 tcp:127.0.0.1:4200 tcp:127.0.0.1:4203 || {
    echo "ERROR: Services did not start in time"
    cat "$LOG_FILE" | tail -50
    exit 1
  }
  
  sleep 2
  echo "Services ready"
}

case "${1:-}" in
  stop)
    stop_services
    ;;
  start)
    stop_services
    start_services "${2:-}"
    ;;
  *)
    echo "Usage: $0 {stop|start [scenario]}"
    exit 1
    ;;
esac
