#!/bin/bash
# Extract axios-only implementation from full index.ts

# Read the full file and make transformations
sed -E '
# Update imports to use core package
s|from '\''\./types'\''|from '\''@sgedda/mockifyer-core'\''|g
s|from '\''\./utils/date'\''|from '\''@sgedda/mockifyer-core'\''|g
s|from '\''\./types/http-client'\''|from '\''@sgedda/mockifyer-core'\''|g
s|from '\''\./utils/mock-matcher'\''|from '\''@sgedda/mockifyer-core'\''|g
s|from '\''\./clients/http-client-factory'\''|// Removed - using AxiosHTTPClient directly|g

# Remove fetch-related imports (if any)
/import.*[Ff]etch/d

# Replace createHTTPClient with direct AxiosHTTPClient instantiation
s|createHTTPClient\(httpClientConfig\)|new AxiosHTTPClient\(config\.axiosInstance\)|g
s|const httpClientConfig: HTTPClientConfig = {[^}]*}|// Direct axios client creation|g

# Remove fetch-related conditionals - simplify to always axios
/httpClientType.*===.*['"]fetch['"]/d
/useGlobalFetch/d
' packages/mockifyer-axios/src/index-full.ts > packages/mockifyer-axios/src/index-temp.ts

echo "Extraction complete"
