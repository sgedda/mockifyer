import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'
import { ArrowLeft, AlertCircle, Radio, Waves, Gauge, XCircle } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'
import QuickStartBox from '@/components/QuickStartBox'

export default function Streaming() {
  return (
    <div className="mx-auto max-w-[900px] px-5 py-16 space-y-12">
      <header>
        <Link to="/guides">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Guides
          </Button>
        </Link>
        <h1
          className="text-4xl sm:text-5xl font-semibold tracking-tight"
          id="streaming"
        >
          Mocking SSE and Streaming APIs with Mockifyer
        </h1>
        <p className="text-muted-foreground mt-4 text-lg">
          Record chunk timelines for Server-Sent Events and chunked HTTP bodies, then replay a real{' '}
          <code className="bg-muted px-1 rounded">ReadableStream</code> with paced delays — without
          inventing a second mock format.
        </p>
      </header>

      <QuickStartBox variant="node-fetch" />

      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-md">
        <p className="text-sm text-muted-foreground">
          <strong>
            Already ran <code className="bg-muted px-1 rounded">npx mockifyer init</code>?
          </strong>{' '}
          Skip to{' '}
          <a href="#how-recording-works" className="text-primary hover:underline">
            How Recording Works
          </a>{' '}
          if you already have <code className="bg-muted px-1 rounded">@sgedda/mockifyer-fetch</code>{' '}
          recording in direct mode.
        </p>
      </div>

      <div className="p-4 border border-amber-500/50 bg-amber-500/10 rounded-md">
        <div className="flex gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-amber-900 dark:text-amber-200 text-sm">
            <strong>Why streams need special handling:</strong> Mockifyer used to save every response
            as one flat body. SSE and chunked responses lost their chunk boundaries and timing on
            replay. Flat JSON mocks still work exactly as before — streaming is an optional{' '}
            <code className="bg-muted px-1 rounded">response.stream</code> timeline beside the
            concatenated <code className="bg-muted px-1 rounded">data</code> field.
          </div>
        </div>
      </div>

      <section id="how-recording-works">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">How Recording Works</h2>
        <p className="text-muted-foreground mb-4">
          When a live response is <code className="bg-muted px-1 rounded">text/event-stream</code> or
          chunked without <code className="bg-muted px-1 rounded">Content-Length</code> (and not a
          typical buffered type like JSON/HTML), Mockifyer records a stream timeline:
        </p>
        <ul className="space-y-3 text-muted-foreground list-disc list-inside mb-6">
          <li>
            <strong>Tee:</strong> the fetch body is teed — your caller still gets the live{' '}
            <code className="bg-muted px-1 rounded">ReadableStream</code> without extra buffering;
            recording runs on the other branch.
          </li>
          <li>
            <strong>Chunk timing:</strong> each chunk stores UTF-8 text plus{' '}
            <code className="bg-muted px-1 rounded">offsetMs</code> from the first chunk, and optional{' '}
            <code className="bg-muted px-1 rounded">firstChunkDelayMs</code> from headers to the first
            byte.
          </li>
          <li>
            <strong>Caps:</strong> recording stops at{' '}
            <code className="bg-muted px-1 rounded">streamRecordMaxBytes</code> (default 1&nbsp;MiB) or{' '}
            <code className="bg-muted px-1 rounded">streamRecordMaxDurationMs</code> (default 30s). Idle
            SSE is raced against the remaining duration budget so quiet streams resolve instead of
            hanging forever.
          </li>
          <li>
            <strong>
              <code className="bg-muted px-1 rounded">truncated</code>:
            </strong>{' '}
            set when a byte or duration cap stops capture while the upstream stream is still open.
          </li>
          <li>
            <strong>Saved after the stream ends or a cap is hit:</strong> the mock file appears once
            background capture finishes (EOF or cap). The caller&apos;s live stream is not delayed.
          </li>
        </ul>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-5 w-5" />
              Setup for streaming record/replay
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock
              language="typescript"
              code={`import { setupMockifyer } from '@sgedda/mockifyer-fetch'

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: true,
  recordResponses: true,
  useGlobalFetch: true,
  // 'accelerated' (default) | 'original' | 'immediate'
  streamReplay: 'accelerated',
  streamRecordMaxBytes: 1_000_000,
  streamRecordMaxDurationMs: 30_000,
})`}
            />
          </CardContent>
        </Card>
      </section>

      <section id="stored-shape">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Stored Mock Shape</h2>
        <p className="text-muted-foreground mb-4">
          <code className="bg-muted px-1 rounded">response.data</code> remains the concatenated body
          for backward compatibility. When a timeline was captured,{' '}
          <code className="bg-muted px-1 rounded">response.stream</code> holds kind, chunks, and
          optional timing / truncation flags:
        </p>
        <CodeBlock
          language="json"
          code={`{
  "status": 200,
  "data": "event: ping\\ndata: 1\\n\\n…",
  "headers": { "content-type": "text/event-stream" },
  "stream": {
    "kind": "sse",
    "firstChunkDelayMs": 12,
    "chunks": [
      { "offsetMs": 0, "data": "event: ping\\n" },
      { "offsetMs": 40, "data": "data: 1\\n\\n" }
    ],
    "truncated": false
  }
}`}
        />
        <p className="text-sm text-muted-foreground mt-4">
          <code className="bg-muted px-1 rounded">kind</code> is{' '}
          <code className="bg-muted px-1 rounded">sse</code> or{' '}
          <code className="bg-muted px-1 rounded">bytes</code>. Mocks without{' '}
          <code className="bg-muted px-1 rounded">stream</code> behave exactly as before (single flat
          body).
        </p>
      </section>

      <section id="replay-modes">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Replay Modes</h2>
        <p className="text-muted-foreground mb-4">
          On replay, mocks with <code className="bg-muted px-1 rounded">stream</code> rebuild a real{' '}
          <code className="bg-muted px-1 rounded">ReadableStream</code> paced by{' '}
          <code className="bg-muted px-1 rounded">streamReplay</code>:
        </p>
        <div className="grid gap-4 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Waves className="h-4 w-4" />
                original
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Emit chunks with the recorded first-chunk delay and inter-chunk delays.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                accelerated (default)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Keep relative spacing but compress the timeline so total paced wait stays bounded
                (about 2 seconds of delays after scaling).
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Radio className="h-4 w-4" />
                immediate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Emit all chunks with no delay — useful when tests only care about chunk order and
                concatenated body.
              </p>
            </CardContent>
          </Card>
        </div>
        <CodeBlock
          language="typescript"
          code={`setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: false,
  useGlobalFetch: true,
  streamReplay: 'accelerated', // or 'original' | 'immediate'
})`}
        />
      </section>

      <section id="drift">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Drift Checks on SSE</h2>
        <p className="text-muted-foreground mb-4">
          Drift checks for stream mocks do not hang on open SSE. They use a capped body read (same
          byte/duration caps as recording) and compare against the concatenated{' '}
          <code className="bg-muted px-1 rounded">response.data</code>. The overall abort timeout
          stays active until the body is consumed.
        </p>
        <div className="p-4 border border-blue-500/50 bg-blue-500/10 rounded-md">
          <p className="text-blue-900 dark:text-blue-200 text-sm">
            See the{' '}
            <Link to="/guides/mock-drift" className="underline font-medium">
              mock drift guide
            </Link>{' '}
            for the CLI workflow. Stream mocks participate via capped reads — not by replaying the
            paced timeline into the drift checker.
          </p>
        </div>
      </section>

      <section id="dashboard-mcp">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Dashboard Timeline and MCP</h2>
        <p className="text-muted-foreground mb-4">
          In the dashboard Mock Editor <strong>Response</strong> tab, stream mocks show a chunk/event
          timeline (kind, chunk count, first-chunk delay, truncated flag, and per-chunk{' '}
          <code className="bg-muted px-1 rounded">+offsetMs</code> previews). The concatenated body
          remains editable below for overrides and drift.
        </p>
        <p className="text-muted-foreground">
          MCP <code className="bg-muted px-1 rounded">get_mock</code> / AI context summarise stream
          events (kind, chunk count, bytes, truncated, short previews) instead of dumping the full
          concatenated body.
        </p>
      </section>

      <section id="limitations">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Limitations (v1)</h2>
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Recording is direct-mode only</strong>
              <p className="text-sm text-muted-foreground">
                Dashboard proxy can <em>replay</em> stream mocks (the client rebuilds a stream from
                stored chunks on mock-hit) but does not record stream timelines yet — upstream still
                buffers.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong>No axios </strong>
              <code className="bg-muted px-1 rounded text-sm">responseType: &apos;stream&apos;</code>
              <p className="text-sm text-muted-foreground">
                Streaming record/replay ships for fetch (Node + browser). Axios stream responses are
                not included in this release.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong>No EventSource patching</strong>
              <p className="text-sm text-muted-foreground">
                Use fetch (or a library built on fetch) against SSE endpoints. Native{' '}
                <code className="bg-muted px-1 rounded">EventSource</code> is not patched.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong>No WebSockets or gRPC</strong>
              <p className="text-sm text-muted-foreground">
                Only HTTP SSE / chunked response bodies on the fetch path.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong>React Native flat fallback</strong>
              <p className="text-sm text-muted-foreground">
                When <code className="bg-muted px-1 rounded">ReadableStream</code> is unavailable,
                Mockifyer falls back to flat bodies (no crash). Stream pacing needs a runtime that
                can put a ReadableStream in a Response body.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Chunked binary bodies stored as text</strong>
              <p className="text-sm text-muted-foreground">
                Chunks are UTF-8 decoded into strings — the pre-existing Mockifyer body model.
                Opaque binary streams are not round-tripped as bytes.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="learn-more">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Learn More</h2>
        <div className="grid gap-4">
          <Link to="/guides/mock-drift">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Stop Mock Drift</h3>
                <p className="text-sm text-muted-foreground">
                  Compare recorded mocks (including capped stream bodies) against live staging APIs
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/guides/browser-record-replay">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Record and Replay HTTP in the Browser</h3>
                <p className="text-sm text-muted-foreground">
                  Memory-provider fetch setup for Vite and Expo web
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link to="/dashboard">
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">Dashboard and MCP</h3>
                <p className="text-sm text-muted-foreground">
                  Browse the stream timeline in Mock Editor and use MCP summaries
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </section>
    </div>
  )
}
