/**
 * Visible FAQ copy for /guides/how-to-mock-api-calls-in-react-native.
 * Kept in sync with FAQPage JSON-LD for that route.
 */
export const RN_GUIDE_FAQ = [
  {
    question: 'Does Mockifyer support Expo API mocking?',
    answer:
      'Yes. setupMockifyerForReactNative targets Expo and React Native. In development it uses the Hybrid provider (device FileSystem plus Metro project sync). Expo web resolves the browser entry of @sgedda/mockifyer-fetch.',
  },
  {
    question: 'How do I make sure mocks are off in release / store builds?',
    answer:
      'Set MOCKIFYER_MODE=off (alias: disabled). Launch arguments are ignored in that mode. Gate recordMode on __DEV__. For E2E-only activation use launch_client. Note: isDev: false alone still loads the Memory provider with bundled mocks when mode is on — off is the hard disable.',
  },
  {
    question: 'Can I mock fetch and axios in React Native?',
    answer:
      'Fetch: yes via @sgedda/mockifyer-fetch and setupMockifyerForReactNative. Axios: yes via @sgedda/mockifyer-axios with useGlobalAxios: true. Patching fetch does not automatically intercept axios on React Native.',
  },
  {
    question: 'Can MSW and Mockifyer coexist?',
    answer:
      'Yes in practice: MSW for a few hand-authored endpoints, Mockifyer for recorded traffic across many systems. Prefer one interceptor per client instance so they do not fight over the same request.',
  },
  {
    question: 'What is Mockifyer global storage / shared mocks?',
    answer:
      'Run the dashboard with --provider redis (or sqlite) so mocks and scenarios live in a shared store. Point the app at the dashboard with initMockifyerForReactNativeDashboard or proxyBaseUrl. Teammates, CI, and demo devices then load the same recordings without local mock-data files.',
  },
] as const
