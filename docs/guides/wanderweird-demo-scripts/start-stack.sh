#!/bin/bash
# Starts the stack the GIFs were recorded against: dashboard (SQLite, :3002), the 7 services in
# proxy mode pinned to scenario guide-demo-2, and the Expo web app on :8090.
. "$(dirname "$0")/common.sh"; cd "$WW"; mkdir -p logs
npm run dashboard:sqlite > logs/dashboard.log 2>&1 &
sleep 8
MOCKIFYER_SCENARIO=$SCENARIO MOCKIFYER_RUNTIME=proxy MOCKIFYER_PROXY_URL=$DASH MOCKIFYER_ACTIVATION_MODE=always \
MOCKIFYER_RECORD=true MOCKIFYER_RECORD_RESPONSES=true MOCKIFYER_DASHBOARD_URL=$DASH \
  npx concurrently -n gateway,auth,trips,wander,cms,lore,graphql "npm run dev -w @wanderweird/gateway-api" "npm run dev -w @wanderweird/auth-api" "npm run dev -w @wanderweird/trips-api" "npm run dev -w @wanderweird/wander-api" "npm run dev -w @wanderweird/cms-api" "npm run dev -w @wanderweird/lore-api" "npm run dev -w @wanderweird/graphql-api" > logs/services.log 2>&1 &
(cd apps/mobile && CI=1 npm run web:demo > ../../logs/web.log 2>&1 &)
echo "dashboard $DASH · gateway :4200 · web app http://localhost:8090 (logs in $WW/logs)"
