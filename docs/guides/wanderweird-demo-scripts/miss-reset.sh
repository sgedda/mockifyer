#!/bin/bash
# Delete the Cloud Nine (Lausanne) forecast mock so the next Discover call for Cloud Nine is a Miss.
# Mockifyer API used: DELETE /api/mocks/<file>?scenario=
. "$(dirname "$0")/common.sh"
F=$(curl -s "$DASH/api/mocks?scenario=$SCENARIO" | node -e 'const p=process.argv[1];for(const f of JSON.parse(require("fs").readFileSync(0)).files) if(f.endpoint.startsWith(p)) console.log(f.filename)' "$CLOUDNINE_PREFIX")
for f in $F; do curl -s -X DELETE "$DASH/api/mocks/$f?scenario=$SCENARIO"; echo; done
