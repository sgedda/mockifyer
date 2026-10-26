#!/bin/bash
# Pair-debugging demo (sbs15): interactive agent fixes the planted -999 via Mockifyer MCP.
. "$(dirname "$0")/common.sh"
exec cursor-agent --trust --approve-mcps --force --sandbox disabled Bug:\ the\ WanderWeird\ Discover\ screen\ shows\ -999\ °C\ for\ Atlantis\ \(Athens\).\ It\ is\ a\ replay-time\ field\ override\ on\ the\ Open-Meteo\ weather\ mock\ in\ Mockifyer\ scenario\ guide-demo-2.\ Use\ the\ Mockifyer\ MCP\ tools\ to\ find\ that\ mock\ and\ its\ field\ override\ on\ current.temperature_2m\,\ clear\ the\ override\,\ and\ confirm\ it\ is\ gone.
