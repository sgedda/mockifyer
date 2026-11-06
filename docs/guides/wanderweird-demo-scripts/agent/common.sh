# Shared setup for the Cursor CLI agent demo. Requires: cursor-agent on PATH, CURSOR_API_KEY set in your env.
AGENT_DIR="${AGENT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null)/agent-demo}"   # copy scripts/agent-demo to <repo>/agent-demo
cd "$AGENT_DIR" || exit 1
: "${CURSOR_API_KEY:?set CURSOR_API_KEY first}"
curl -sf -o /dev/null "${MOCKIFYER_DASHBOARD_URL:-http://127.0.0.1:3002}/api/health" || { echo "Mockifyer dashboard is down"; exit 1; }
cursor-agent mcp enable mockifyer >/dev/null 2>&1   # pre-approve the project MCP server
