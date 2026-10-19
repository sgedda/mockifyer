import { useState, type CSSProperties, type ReactNode } from 'react';
import type { CrashSuspect } from '../utils/incidents';
import { buildHopDisplayRows, formatHopLineForDisplay } from '../utils/hop-display';
import type { NetworkEvent } from '../utils/network-event-types';
import type { MockifyerCrashFallbackProps, MockifyerHopListProps } from './MockifyerHopList.types';

export type { MockifyerCrashFallbackProps, MockifyerHopListProps } from './MockifyerHopList.types';

const DEFAULT_VISIBLE_HOPS = 8;

function isSuspect(hop: NetworkEvent, suspects?: CrashSuspect[]): boolean {
  if (!suspects?.length) return Boolean(hop.anomalyFlags?.length);
  return suspects.some((s) => s.eventId === hop.id);
}

const panelStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  fontSize: '12px',
  lineHeight: 1.45,
};

const cardStyle: CSSProperties = {
  border: '1px solid #444',
  borderRadius: '8px',
  padding: '12px',
  marginTop: '12px',
  background: '#111',
  color: '#eee',
};

function HopRow({
  hop,
  suspects,
  prefetchHopIds,
}: {
  hop: NetworkEvent;
  suspects?: MockifyerHopListProps['suspects'];
  prefetchHopIds?: string[];
}): ReactNode {
  const suspect = isSuspect(hop, suspects);
  const isPrefetch = prefetchHopIds?.includes(hop.id);
  return (
    <li style={{ marginBottom: '6px', color: suspect ? '#ffb4b4' : undefined }}>
      {isPrefetch ? <span style={{ opacity: 0.7 }}>(prefetch) </span> : null}
      {formatHopLineForDisplay(hop)}
    </li>
  );
}

function ScreenHeader({ screen }: { screen: string }): ReactNode {
  return (
    <li
      style={{
        listStyle: 'none',
        margin: '6px 0 2px',
        color: '#7eb8ff',
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {screen}
    </li>
  );
}

function HopTimeline({
  hops,
  suspects,
  prefetchHopIds,
}: {
  hops: NetworkEvent[];
  suspects?: MockifyerHopListProps['suspects'];
  prefetchHopIds?: string[];
}): ReactNode {
  const rows = buildHopDisplayRows(hops);
  return (
    <>
      {rows.map((row, index) =>
        row.kind === 'screen-header' ? (
          <ScreenHeader key={`screen-${row.screen}-${index}`} screen={row.screen} />
        ) : (
          <HopRow
            key={row.hop.id}
            hop={row.hop}
            suspects={suspects}
            prefetchHopIds={prefetchHopIds}
          />
        )
      )}
    </>
  );
}

/** Read-only hop list — expects most-relevant-first order. */
export function MockifyerHopList({
  hops,
  suspects,
  prefetchHopIds,
  maxItems,
}: MockifyerHopListProps): ReactNode {
  const items = maxItems != null ? hops.slice(0, maxItems) : hops;

  if (items.length === 0) {
    return (
      <div style={{ ...panelStyle, ...cardStyle, opacity: 0.8 }}>
        No Mockifyer hops in this time window. Browse CMS screens first so hops carry screen labels.
      </div>
    );
  }

  return (
    <div style={{ ...panelStyle, ...cardStyle }}>
      <strong>
        Network context ({hops.length} hop{hops.length === 1 ? '' : 's'}, most relevant first)
      </strong>
      <ol style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
        <HopTimeline hops={items} suspects={suspects} prefetchHopIds={prefetchHopIds} />
      </ol>
    </div>
  );
}

/** Default ErrorBoundary fallback — error first; ranked hops visible by default. */
export function MockifyerCrashFallback({
  error,
  crashContext,
  incidentId,
  dashboardExplainUrl,
  localTraceBrowseUrl,
  localTraceFileHint,
  visibleHopCount = DEFAULT_VISIBLE_HOPS,
}: MockifyerCrashFallbackProps): ReactNode {
  const [showAllHops, setShowAllHops] = useState(false);
  const [stackExpanded, setStackExpanded] = useState(false);

  const hops = crashContext?.hops ?? [];
  const hopCount = hops.length;
  const suspectCount = crashContext?.suspects.length ?? 0;
  const visibleHops = showAllHops ? hops : hops.slice(0, visibleHopCount);
  const hasMoreHops = hopCount > visibleHopCount;

  return (
    <div style={{ ...panelStyle, padding: '16px', color: '#eee', background: '#1a1a1a', minHeight: '100vh' }}>
      <h2 style={{ margin: 0, color: '#ff6b6b', fontSize: '18px' }}>Something went wrong</h2>
      <pre style={{ whiteSpace: 'pre-wrap', color: '#ffb4b4', marginTop: '8px', fontSize: '14px' }}>
        {error.message}
      </pre>

      {error.stack ? (
        <div style={{ marginTop: '8px' }}>
          <button
            type="button"
            onClick={() => setStackExpanded((v) => !v)}
            style={{
              background: 'transparent',
              border: '1px solid #555',
              color: '#aaa',
              borderRadius: '4px',
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            {stackExpanded ? 'Hide stack' : 'Show stack'}
          </button>
          {stackExpanded ? (
            <pre style={{ whiteSpace: 'pre-wrap', color: '#888', marginTop: '8px', fontSize: '11px' }}>
              {error.stack}
            </pre>
          ) : null}
        </div>
      ) : null}

      {incidentId ? (
        <p style={{ opacity: 0.5, fontSize: '11px', marginTop: '8px' }}>Mockifyer incident: {incidentId}</p>
      ) : null}

      {dashboardExplainUrl ? (
        <a
          href={dashboardExplainUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginTop: '8px',
            background: 'transparent',
            border: '1px solid #555',
            color: '#aaa',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          Open in dashboard
        </a>
      ) : null}

      {localTraceBrowseUrl ? (
        <a
          href={localTraceBrowseUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginTop: '8px',
            marginLeft: '8px',
            background: 'transparent',
            border: '1px solid #555',
            color: '#aaa',
            borderRadius: '4px',
            padding: '4px 8px',
            cursor: 'pointer',
            textDecoration: 'none',
          }}
        >
          Open trace HTML
        </a>
      ) : null}

      {localTraceFileHint ? (
        <p style={{ color: '#7eb8ff', fontSize: '11px', marginTop: '6px' }}>{`Local: ${localTraceFileHint}`}</p>
      ) : null}

      {hopCount > 0 ? (
        <div style={{ marginTop: '12px' }}>
          {suspectCount > 0 ? (
            <p style={{ color: '#ffd166', margin: '0 0 8px', fontSize: '12px' }}>
              {suspectCount} hop{suspectCount === 1 ? '' : 's'} flagged · showing most relevant first
            </p>
          ) : (
            <p style={{ color: '#888', margin: '0 0 8px', fontSize: '12px' }}>
              {hopCount} hop{hopCount === 1 ? '' : 's'} in window · showing most relevant first
            </p>
          )}

          <div style={{ ...cardStyle, marginTop: 0 }}>
            <ol style={{ margin: 0, paddingLeft: '18px' }}>
              <HopTimeline
                hops={visibleHops}
                suspects={crashContext!.suspects}
                prefetchHopIds={crashContext!.prefetchHopIds}
              />
            </ol>
          </div>

          {hasMoreHops ? (
            <button
              type="button"
              onClick={() => setShowAllHops((v) => !v)}
              style={{
                marginTop: '8px',
                background: 'transparent',
                border: '1px solid #555',
                color: '#aaa',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer',
              }}
            >
              {showAllHops ? 'Show fewer hops' : `Show all ${hopCount} hops`}
            </button>
          ) : null}
        </div>
      ) : crashContext ? (
        <div style={{ ...cardStyle, opacity: 0.8 }}>
          No network hops in the last {Math.round((crashContext.windowMs ?? 60000) / 1000)}s — browse
          AppDun / CMS screens first so hops show screen and CMS labels
        </div>
      ) : null}
    </div>
  );
}
