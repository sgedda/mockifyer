#!/bin/bash
# Plant the demo bug: field override current.temperature_2m = -999 on the Athens forecast mock.
# Mockifyer API used: PATCH /api/mocks/<file>/field-overrides  (same call as MCP tool mockifyer_set_field_overrides)
. "$(dirname "$0")/common.sh"; F=$(find_mock "$ATHENS_FORECAST") || exit 1
curl -s -X PATCH -H 'content-type: application/json' "$DASH/api/mocks/$F/field-overrides?scenario=$SCENARIO" \
  -d '{"responseFieldOverrides":[{"path":"current.temperature_2m","value":-999}]}' >/dev/null && echo "bug planted on $F"
