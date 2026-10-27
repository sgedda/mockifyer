#!/bin/bash
# Remove all field overrides from the Athens forecast mock (PATCH .../field-overrides with []).
. "$(dirname "$0")/common.sh"; F=$(find_mock "$ATHENS_FORECAST") || exit 1
curl -s -X PATCH -H 'content-type: application/json' "$DASH/api/mocks/$F/field-overrides?scenario=$SCENARIO" \
  -d '{"responseFieldOverrides":[]}' >/dev/null && echo reset
