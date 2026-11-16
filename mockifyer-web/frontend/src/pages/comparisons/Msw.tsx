import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function Msw() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-8">
      <header>
        <Link to="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mb-4">Mockifyer vs MSW</h1>
        <p className="text-xl text-muted-foreground">An honest comparison from Mockifyer's author. MSW is the pick for hand-written handlers in browser and Node tests and for GraphQL. Mockifyer records real JSON and replays it selectively, with scenarios and React Native support.</p>
      </header>

      <div className="space-y-6">
        <p className="mb-4 text-muted-foreground">&#62; <strong>Disclosure:</strong> I'm Sebastian, and I build Mockifyer. I've tried to keep this comparison fair, and every MSW claim links to MSW's own docs at the bottom.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="the-short-version">The short version</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><strong>Choose MSW</strong> when you want to <em>describe</em> API behaviour in code ("when request X happens, respond with Y") and reuse those handlers across browser, Node tests, Storybook and dev. It's especially strong for GraphQL and WebSocket mocking.</li>
          <li><strong>Choose Mockifyer</strong> when you'd rather <em>record</em> what the real API returns, keep it as JSON in the repo, decide per path what gets replayed, and switch whole data sets (scenarios) for dev and E2E, including in React Native and Expo.</li>
        </ul>
        <p className="mb-4 text-muted-foreground">They don't solve the same problem, and you can use both.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="how-they-differ">How they differ</h2>
        <div className="overflow-x-auto my-6">
          <table className="min-w-full border-collapse">
            <tr>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">MSW</th>
              <th className="border border-border px-4 py-2 text-left font-semibold bg-muted">Mockifyer</th>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Where mocks come from</td>
              <td className="border border-border px-4 py-2">Request handlers you write (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">http.get(...)</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">graphql.query(...)</code>)</td>
              <td className="border border-border px-4 py-2">Recordings of real traffic, saved as JSON files you can edit</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Environments</td>
              <td className="border border-border px-4 py-2">Browser (Service Worker), Node.js, React Native (see note below)</td>
              <td className="border border-border px-4 py-2">Node.js (axios, fetch) and React Native/Expo (fetch). Browser support is in progress (PR #495) and isn't released yet.</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Interception</td>
              <td className="border border-border px-4 py-2">Service Worker in the browser; interceptors in Node</td>
              <td className="border border-border px-4 py-2">Patches global <code className="text-sm bg-muted px-1.5 py-0.5 rounded">fetch</code> / axios interceptors in-process; optional dashboard proxy</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">GraphQL</td>
              <td className="border border-border px-4 py-2">First-class handler API</td>
              <td className="border border-border px-4 py-2">Matches recorded GraphQL requests by normalized query + sorted variables. There's no handler API.</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Choosing what's mocked</td>
              <td className="border border-border px-4 py-2">Whatever you write handlers for</td>
              <td className="border border-border px-4 py-2">Recording is selective: new requests become request-only stubs and stay live until you turn on the path's rule and activate them</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Switching data sets</td>
              <td className="border border-border px-4 py-2">Swap or override handlers (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">server.use(...)</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">resetHandlers()</code>)</td>
              <td className="border border-border px-4 py-2">Scenario folders, switched by dashboard, env, config or an RN launch argument</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">Extra tooling</td>
              <td className="border border-border px-4 py-2">Large ecosystem (for example <code className="text-sm bg-muted px-1.5 py-0.5 rounded">@msw/data</code> for data modeling)</td>
              <td className="border border-border px-4 py-2">Local dashboard (edit mocks, replay modes, per-path rules), date control (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">getCurrentDate()</code>), MCP server (built from source, not on npm)</td>
            </tr>
            <tr>
              <td className="border border-border px-4 py-2">License</td>
              <td className="border border-border px-4 py-2">MIT</td>
              <td className="border border-border px-4 py-2">MIT</td>
            </tr>
          </table>
        </div>
        <p className="mb-4 text-muted-foreground"><strong>About React Native:</strong> MSW does support React Native. MSW 2.x shipped it as <code className="text-sm bg-muted px-1.5 py-0.5 rounded">msw/native</code>. The current MSW docs describe a dedicated <code className="text-sm bg-muted px-1.5 py-0.5 rounded">@msw/react-native</code> package that intercepts both <code className="text-sm bg-muted px-1.5 py-0.5 rounded">fetch</code> and <code className="text-sm bg-muted px-1.5 py-0.5 rounded">XMLHttpRequest</code>. Check their React Native page for the install that matches your MSW version.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="where-msw-is-the-better-choice">Where MSW is the better choice</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><strong>Contract-first or API-not-built-yet work.</strong> If the backend doesn't exist, there's nothing to record. Handlers are the natural fit.</li>
          <li><strong>Logic in responses.</strong> Handlers can branch on the request, compute values, and use TypeScript. Mockifyer has field and date overrides on recordings, but it isn't a programmable server.</li>
          <li><strong>Browser apps and Storybook today.</strong> MSW's Service Worker approach is mature. Mockifyer's browser support isn't released yet.</li>
          <li><strong>GraphQL and WebSocket mocking from scratch.</strong> MSW has dedicated APIs for both.</li>
        </ul>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="where-mockifyer-is-the-better-choice">Where Mockifyer is the better choice</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><strong>Big, real payloads.</strong> Recording a real response is quicker than hand-writing a 300-field JSON handler, and it starts out matching the real API's shape. (It can drift later. See <Link to="/guides/mock-drift" className="text-primary hover:underline">mock drift</Link>.)</li>
          <li><strong>Selective recording.</strong> You browse the app, get an inventory of request-only stubs, and turn on replay only for the endpoints you care about. See <Link to="/guides/selective-recording" className="text-primary hover:underline">Selective HTTP Recording</Link>.</li>
          <li><strong>Named data sets for E2E.</strong> <code className="text-sm bg-muted px-1.5 py-0.5 rounded">trips-empty</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">trips-error</code> and friends as folders, picked per run with a <code className="text-sm bg-muted px-1.5 py-0.5 rounded">scenario</code> launch argument in Maestro or Detox. See <Link to="/guides/scenarios" className="text-primary hover:underline">Scenarios</Link>.</li>
          <li><strong>React Native dev loop.</strong> Recordings made on a simulator are written into the repo through Metro, so they're reviewed in a PR like code.</li>
        </ul>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="using-both">Using both</h2>
        <p className="mb-4 text-muted-foreground">A setup that works well: MSW handlers for component and unit tests, plus edge cases that are easier to write than to record, and Mockifyer for dev sessions and E2E runs that need realistic data from the real API. Both work at the request level. Make sure only one of them handles a given request in a given process.</p>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="related">Related</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li><Link to="/getting-started" className="text-primary hover:underline">Getting started</Link> · <Link to="/packages" className="text-primary hover:underline">Packages</Link> · <Link to="/comparisons" className="text-primary hover:underline">All comparisons</Link></li>
          <li><Link to="/guides/react-native-expo" className="text-primary hover:underline">React Native and Expo with Mockifyer</Link></li>
          <li><Link to="/guides/selective-recording" className="text-primary hover:underline">Selective HTTP Recording</Link></li>
          <li><Link to="/guides/react-native-without-msw" className="text-primary hover:underline">Mocking React Native without MSW handlers</Link></li>
        </ul>
        <h2 className="text-2xl font-semibold mb-4 mt-8" id="sources">Sources</h2>
        <p className="mb-4 text-muted-foreground">MSW (checked 11 Nov 2026):</p>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li>MSW introduction (browser and Node.js, any request client, REST/GraphQL/WebSocket): https://mswjs.io/docs/</li>
          <li>MSW philosophy ("network behavior", request handlers): https://mswjs.io/docs/philosophy</li>
          <li>MSW comparison page (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">@msw/data</code>, Service Worker interception): https://mswjs.io/docs/comparison</li>
          <li>MSW React Native integration (<code className="text-sm bg-muted px-1.5 py-0.5 rounded">@msw/react-native</code>, fetch + XMLHttpRequest, removal of <code className="text-sm bg-muted px-1.5 py-0.5 rounded">msw/native</code>): https://mswjs.io/docs/integrations/react-native</li>
          <li>MSW GraphQL API: https://mswjs.io/docs/api/graphql</li>
          <li>MSW Node.js integration: https://mswjs.io/docs/integrations/node</li>
          <li>MSW license (MIT): https://github.com/mswjs/msw</li>
          <li>npm: <code className="text-sm bg-muted px-1.5 py-0.5 rounded">msw@2.15.0</code> exports <code className="text-sm bg-muted px-1.5 py-0.5 rounded">./native</code>; <code className="text-sm bg-muted px-1.5 py-0.5 rounded">msw@3.0.5</code> (latest) does not: https://www.npmjs.com/package/msw</li>
        </ul>
        <p className="mb-4 text-muted-foreground">Mockifyer:</p>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground mb-4">
          <li>Recording defaults (request-only stubs): <code className="text-sm bg-muted px-1.5 py-0.5 rounded">packages/mockifyer-core/src/utils/request-only-mock.ts</code>, <code className="text-sm bg-muted px-1.5 py-0.5 rounded">packages/mockifyer-core/src/types.ts</code></li>
          <li>Domain-path rules: <code className="text-sm bg-muted px-1.5 py-0.5 rounded">packages/mockifyer-core/src/utils/domain-path-rules.ts</code></li>
          <li>GraphQL request keys: https://mockifyer.dev/llms-full.txt</li>
          <li>Browser support PR (open): https://github.com/sgedda/mockifyer/pull/495</li>
          <li>License: https://github.com/sgedda/mockifyer/blob/main/LICENSE</li>
        </ul>
      </div>
    </div>
  )
}
