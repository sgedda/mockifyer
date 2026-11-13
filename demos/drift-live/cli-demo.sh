#!/bin/bash
set -e

echo "=== Mockifyer Drift Detection CLI Demo ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Start backend in v1 mode
echo "Starting backend in v1 mode..."
API_VERSION=v1 PORT=4100 node backend.js &
BACKEND_PID=$!
sleep 2

# Cleanup function
cleanup() {
  echo ""
  echo "Cleaning up..."
  kill $BACKEND_PID 2>/dev/null || true
}
trap cleanup EXIT

echo ""
echo "Step 1: Run drift check against v1 (should pass)"
echo "-----------------------------------------------"
npx mockifyer-drift-check --mock-data-path ./mock-data || true
echo ""

echo "Step 2: Switch backend to v2 (with breaking changes)"
echo "-----------------------------------------------------"
kill $BACKEND_PID
sleep 1
API_VERSION=v2 PORT=4100 node backend.js &
BACKEND_PID=$!
sleep 2

echo ""
echo "Step 3: Run drift check against v2 (should fail)"
echo "------------------------------------------------"
set +e
npx mockifyer-drift-check --mock-data-path ./mock-data
EXIT_CODE=$?
set -e

if [ $EXIT_CODE -eq 1 ]; then
  echo ""
  echo -e "${RED}✗ Drift detected (exit code 1)${NC}"
else
  echo ""
  echo -e "${YELLOW}Unexpected exit code: $EXIT_CODE${NC}"
fi

echo ""
echo "Step 4: Accept drift for critical endpoint /api/trips"
echo "------------------------------------------------------"
npx mockifyer-drift-check --accept "GET /api/trips" --mock-data-path ./mock-data

echo ""
echo "Step 5: Show git diff of accepted mock"
echo "---------------------------------------"
git diff --no-index --no-pager mock-data/drift-watch/localhost:4100/api/trips/GET.json.backup mock-data/drift-watch/localhost:4100/api/trips/GET.json 2>/dev/null || echo "(No backup found - this is expected on first run)"

echo ""
echo "Step 6: Run drift check again (should pass)"
echo "--------------------------------------------"
npx mockifyer-drift-check --mock-data-path ./mock-data

echo ""
echo -e "${GREEN}✓ Demo complete! Drift resolved after accepting changes.${NC}"
echo ""
echo "Summary:"
echo "  - Detected breaking drift when API changed"
echo "  - Accepted live response for critical endpoint"
echo "  - Drift check now passes with updated mock"
