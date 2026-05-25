export interface FaqItem {
  question: string
  answer: string
}

export const HOME_FAQ: FaqItem[] = [
  {
    question: 'What is Mockifyer?',
    answer:
      'Mockifyer is an open-source monorepo of npm packages (@sgedda/mockifyer-core, mockifyer-axios, mockifyer-fetch, and optional dashboard/MCP tools) that record and replay HTTP calls as JSON mocks in your repository.',
  },
  {
    question: 'How do I record API calls with Mockifyer?',
    answer:
      'Install @sgedda/mockifyer-axios or mockifyer-fetch, call setupMockifyer({ mockDataPath: "./mock-data", recordMode: true }) before your HTTP client imports, then run with MOCKIFYER_RECORD=true. Responses are saved under mock-data/<scenario>/.',
  },
  {
    question: 'How is Mockifyer different from MSW?',
    answer:
      'MSW uses in-code handlers. Mockifyer is record-and-replay at the axios/fetch layer: capture live responses once, store searchable JSON, switch scenarios, use the dashboard to activate passthrough mocks, and optionally connect mockifyer-mcp for IDE assistants.',
  },
  {
    question: 'Does Mockifyer support GraphQL?',
    answer:
      'Yes. Matching uses the normalized GraphQL query string plus sorted variables JSON — not operationName or headers alone.',
  },
  {
    question: 'What is MOCKIFYER_MODE vs MOCKIFYER_ACTIVATION_MODE?',
    answer:
      'MOCKIFYER_MODE (on | launch_client | off) gates React Native fetch patching at startup. MOCKIFYER_ACTIVATION_MODE (always | client_id_header | off) controls per-request interception on Node axios/fetch — use client_id_header with X-Mockifyer-Client-Id for multi-service setups.',
  },
  {
    question: 'What are the dashboard and MCP packages for?',
    answer:
      '@sgedda/mockifyer-dashboard is a local UI/CLI to browse and edit mocks, switch scenarios, and run a Redis proxy with client lanes. @sgedda/mockifyer-mcp exposes search, AI context, and field overrides to Cursor or Claude Desktop while the dashboard is running.',
  },
  {
    question: 'Where is the official documentation?',
    answer:
      'https://mockifyer.dev — Getting Started, config reference, playground. Source: https://github.com/sgedda/mockifyer. AI summaries: https://mockifyer.dev/llms.txt',
  },
]
