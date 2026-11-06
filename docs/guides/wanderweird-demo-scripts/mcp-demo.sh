#!/bin/bash
# Scripted MCP session for sbs7: three real Mockifyer MCP tool calls over stdio.
D="$(cd "$(dirname "$0")" && pwd)"; . "$D/common.sh"; cd "$REPO"; F=$(find_mock "$ATHENS_FORECAST")
say(){ printf '\n\033[1;36m> %s\033[0m\n' "$1"; sleep 1.2; }
call(){ printf '\033[1;33mtool call: %s\033[0m %s\n' "$1" "$2" >&2; node "$D/mcp-demo.mjs" "$1" "$2"; }
clear; printf '\033[1mMockifyer MCP server (stdio) -> dashboard %s\033[0m\n' "$DASH"
say "Which forecast mocks are recorded in $SCENARIO?"
call mockifyer_search_mocks '{"q":"forecast","scenario":"'$SCENARIO'"}' | node -e 'const j=JSON.parse(require("fs").readFileSync(0));for(const f of j.files)console.log("  "+f.filename.slice(6,18)+"…  "+f.replayMode.padEnd(11)+" lat="+f.endpoint.match(/latitude=([^&]*)/)[1])'
sleep 2; say "Show the current weather in the Athens (Atlantis) mock"
call mockifyer_get_mock '{"filename":"'$F'","scenario":"'$SCENARIO'"}' | node -e 'const j=JSON.parse(require("fs").readFileSync(0));console.log(JSON.stringify(j.data.response.data.current,null,2))'
sleep 2; say "Make it a heatwave: set current.temperature_2m to 42"
call mockifyer_set_field_overrides '{"filename":"'$F'","scenario":"'$SCENARIO'","overrides":[{"path":"current.temperature_2m","value":42}]}'
printf '\n\033[1;32mDone. Reload Discover in the app.\033[0m\n'
