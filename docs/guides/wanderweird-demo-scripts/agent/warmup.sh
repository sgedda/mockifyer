#!/bin/bash
# Checks the MCP server loads and answers (no edits). Expect "mockifyer: ready" and a number.
. "$(dirname "$0")/common.sh"
cursor-agent mcp list
cursor-agent -p --trust --approve-mcps --force --sandbox disabled "Call mockifyer_list_scenarios once and reply with just the number of scenarios."
