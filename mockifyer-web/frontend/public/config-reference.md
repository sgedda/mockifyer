# Mockifyer configuration reference

Interactive reference: https://mockifyer.dev/config-reference

## setupMockifyer (axios / fetch)

```typescript
{
  mockDataPath: string;
  recordMode?: boolean;
  failOnMissingMock?: boolean;
  activationMode?: 'always' | 'client_id_header' | 'off';
  clientId?: string;
  useGlobalAxios?: boolean;   // axios
  useGlobalFetch?: boolean;   // fetch
  runtimeMode?: 'on' | 'launch_client' | 'off';  // React Native
  recordNewMocksAsPassthrough?: boolean;
  refreshPassthroughRecordings?: boolean;
  useSimilarMatch?: boolean;
  dateManipulation?: { fixedDate?, offset?, timezone? };
  generateTests?: { enabled?, framework?, outputPath? };
  proxy?: { baseUrl?, strictLaneScenario? };  // fetch + dashboard
}
```

## Environment variables

| Variable | Purpose |
|----------|---------|
| MOCKIFYER_RECORD | Record real responses |
| MOCKIFYER_PATH | Mock data root |
| MOCKIFYER_SCENARIO | Active scenario folder |
| MOCKIFYER_MODE | RN startup: on \| launch_client \| off |
| MOCKIFYER_ACTIVATION_MODE | always \| client_id_header \| off |
| MOCKIFYER_CLIENT_ID | Client lane for scenario isolation |
| MOCKIFYER_DATE / OFFSET / TIMEZONE | Date manipulation |
| MOCKIFYER_USE_SIMILAR_MATCH | Path-level fallback matching |
| MOCKIFYER_RECORD_NEW_AS_PASSTHROUGH | New mocks stay on live API until activated |
| MOCKIFYER_REFRESH_PASSTHROUGH_RECORDINGS | Refresh passthrough files on each live call |
| MOCKIFYER_STRICT_SCENARIO | Proxy: require clientId/scenario |
| MOCKIFYER_STRICT_LANE_SCENARIO | Proxy: lane-only scenario (default with proxy) |
| MOCKIFYER_DASHBOARD_URL | SDK network log POST target |

## GraphQL

Request keys use normalized query + sorted variables.

## Dashboard

```bash
npx @sgedda/mockifyer-dashboard --path ./mock-data
```

## MCP (@sgedda/mockifyer-mcp)

Requires running dashboard. Tools: `mockifyer_get_mock_ai_context`, `mockifyer_search_mocks`, `mockifyer_set_field_overrides`, `mockifyer_list_scenarios`, etc.

## Links

- [Getting started](https://mockifyer.dev/getting-started.md)
- [GitHub README](https://github.com/sgedda/mockifyer)
