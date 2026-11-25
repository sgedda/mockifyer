/**
 * Self-contained HTML export for cards (inline CSS + keyframe animations).
 * Paste into a blank page or CodePen — looks like the playground cards view.
 */

import type { CardTheme, MockCard } from './types'
import { CARDS_SHARED_CSS, staggerDelayStyle, themeClass } from './styles'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderCardHtml(card: MockCard, index: number): string {
  const fields = card.fields
    .map(
      (field) =>
        `<li><span class="lbl">${escapeHtml(field.label)}</span><span class="val">${escapeHtml(field.value)}</span></li>`
    )
    .join('')
  const badge = card.badge
    ? `<span class="mdg-card-badge">${escapeHtml(card.badge)}</span>`
    : ''
  const subtitle = card.subtitle
    ? `<p class="mdg-card-sub">${escapeHtml(card.subtitle)}</p>`
    : ''
  const highlight = card.highlight
    ? `<div class="mdg-card-highlight mdg-count">${escapeHtml(card.highlight)}</div>`
    : ''
  return `
<article class="mdg-card-scene mdg-enter" style="${staggerDelayStyle(index)}" data-card-id="${escapeHtml(card.id)}">
  <div class="mdg-card-flip">
    <div class="mdg-card-face mdg-card-front">
      <div class="mdg-card-kicker">${escapeHtml(card.kind)}</div>
      <h3 class="mdg-card-title">${escapeHtml(card.title)}</h3>
      ${subtitle}
      ${badge}
      ${fields ? `<ul class="mdg-card-fields">${fields}</ul>` : ''}
      ${highlight}
    </div>
    <div class="mdg-card-face mdg-card-back">
      <div class="mdg-card-kicker">JSON</div>
      <pre>${escapeHtml(card.rawJson)}</pre>
    </div>
  </div>
</article>`.trim()
}

export interface ExportCardsHtmlOptions {
  cards: MockCard[]
  theme: CardTheme
  /** Include flip-on-click script (default true). */
  interactive?: boolean
  title?: string
}

/**
 * Full HTML document with inline CSS so paste/preview matches the live cards.
 */
export function exportCardsHtml(options: ExportCardsHtmlOptions): string {
  const { cards, theme, interactive = true, title = 'Mockifyer mock cards' } = options
  const grid = cards.map((card, index) => renderCardHtml(card, index)).join('\n')
  const script = interactive
    ? `<script>
(function () {
  document.querySelectorAll('.mdg-card-scene').forEach(function (el) {
    el.addEventListener('click', function () {
      el.classList.toggle('is-flipped');
    });
  });
})();
</script>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
${CARDS_SHARED_CSS}
body { margin: 0; background: #f5f5f4; padding: 1.5rem; }
</style>
</head>
<body>
<div class="mdg-cards-root ${themeClass(theme)}" data-theme="${escapeHtml(theme)}">
  <div class="mdg-cards-grid">
${grid}
  </div>
</div>
${script}
</body>
</html>
`
}

/** Grid-only fragment (for embedding inside an existing page). */
export function exportCardsHtmlFragment(options: ExportCardsHtmlOptions): string {
  const { cards, theme } = options
  const grid = cards.map((card, index) => renderCardHtml(card, index)).join('\n')
  return `<style>${CARDS_SHARED_CSS}</style>
<div class="mdg-cards-root ${themeClass(theme)}">
  <div class="mdg-cards-grid">${grid}</div>
</div>`
}

/**
 * Live embed snippet: iframe pointing at a share URL (cards surface).
 */
export function exportCardsEmbedSnippet(shareUrl: string, opts?: { height?: number }): string {
  const height = opts?.height ?? 480
  const safe = escapeHtml(shareUrl)
  return `<!-- Mockifyer cards embed — opens the exact seeded cards view -->
<iframe
  src="${safe}"
  title="Mockifyer mock cards"
  loading="lazy"
  referrerpolicy="no-referrer"
  style="width:100%;max-width:960px;height:${height}px;border:1px solid #e7e5e4;border-radius:12px;background:#fafaf9;"
></iframe>`
}
