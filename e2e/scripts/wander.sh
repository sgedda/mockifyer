#!/usr/bin/env bash
set -euo pipefail

# Stop/start wander-api (:4203), the only WanderWeird service that calls Open-Meteo.
# The rest of the stack (gateway :4200 etc.) is left running. See ww-service.sh for the env it reads.
#   wander.sh stop              kill the :4203 listener and its tsx-watch parent, wait until the port is closed
#   wander.sh start             start wander-api unpinned (scenario resolved from the client lane)
#   wander.sh start <scenario>  start wander-api pinned via MOCKIFYER_SCENARIO

exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/ww-service.sh" wander-api "$@"
