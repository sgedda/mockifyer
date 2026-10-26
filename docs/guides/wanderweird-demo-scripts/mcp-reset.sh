#!/bin/bash
# Undo the MCP heatwave edit (sbs7): clears the field overrides on the Athens forecast mock.
. "$(dirname "$0")/common.sh"; F=$(find_mock "$ATHENS_FORECAST") || exit 1
curl -s -X PATCH -H 'content-type: application/json' "$DASH/api/mocks/$F/field-overrides?scenario=$SCENARIO" \
  -d '{"responseFieldOverrides":[]}' >/dev/null && echo reset
