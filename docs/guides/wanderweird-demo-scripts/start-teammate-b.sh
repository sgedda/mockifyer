#!/bin/bash
# Second Mockifyer client "teammate-b" (no pinned scenario, so it follows its client lane):
# wander-api on :4213 and graphql-api on :4216. Used by the lanes clips (sbs9, sbs11).
. "$(dirname "$0")/common.sh"; cd "$WW"; mkdir -p logs
B="MOCKIFYER_CLIENT_ID=teammate-b MOCKIFYER_RUNTIME=proxy MOCKIFYER_PROXY_URL=$DASH MOCKIFYER_DASHBOARD_URL=$DASH MOCKIFYER_ACTIVATION_MODE=always MOCKIFYER_RECORD=true MOCKIFYER_RECORD_RESPONSES=true MOCKIFYER_PATH=../../mock-data"
(cd services/wander-api && env $B PORT=4213 npx tsx src/server.ts > ../../logs/teammate-b-wander.log 2>&1 &)
(cd services/graphql-api && env $B PORT=4216 WANDER_URL=http://127.0.0.1:4213 npx tsx src/server.ts > ../../logs/teammate-b-graphql.log 2>&1 &)
echo "teammate-b: wander :4213, graphql :4216"
