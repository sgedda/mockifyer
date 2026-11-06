# Shared by ww-service.sh and scratch-dashboard.sh; expects PORT to be set by the caller.

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
