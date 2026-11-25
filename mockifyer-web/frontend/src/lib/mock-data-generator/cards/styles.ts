/**
 * Self-contained CSS for card themes + motion.
 * Shared by the live React view, Copy-as-HTML, and Copy-as-React exports.
 */

import type { CardTheme } from './types'

/** Keyframes + reduced-motion + base layout (once per document). */
export const CARDS_SHARED_CSS = `
.mdg-cards-root {
  --mdg-font: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
  --mdg-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --mdg-ink: #1c1917;
  --mdg-muted: #57534e;
  --mdg-line: #e7e5e4;
  --mdg-paper: #fafaf9;
  --mdg-accent: #0f766e;
  --mdg-accent-soft: #ccfbf1;
  font-family: var(--mdg-font);
  color: var(--mdg-ink);
  box-sizing: border-box;
}
.mdg-cards-root *, .mdg-cards-root *::before, .mdg-cards-root *::after { box-sizing: border-box; }
.mdg-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem;
  padding: 0.25rem;
}
.mdg-card-scene {
  perspective: 1200px;
  min-height: 220px;
}
.mdg-card-flip {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  min-height: 220px;
  transform-style: preserve-3d;
  transition: transform 0.55s cubic-bezier(0.22, 1, 0.36, 1);
}
.mdg-card-scene.is-flipped .mdg-card-flip { transform: rotateY(180deg); }
.mdg-card-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 1rem 1.1rem;
}
.mdg-card-back {
  transform: rotateY(180deg);
  background: #1c1917;
  color: #e7e5e4;
}
.mdg-card-back pre {
  margin: 0;
  flex: 1;
  overflow: auto;
  font-family: var(--mdg-mono);
  font-size: 0.7rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}
.mdg-card-kicker {
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--mdg-muted);
  margin-bottom: 0.35rem;
}
.mdg-card-title {
  font-size: 1.15rem;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.25;
  margin: 0;
}
.mdg-card-sub {
  margin: 0.25rem 0 0;
  font-size: 0.85rem;
  color: var(--mdg-muted);
}
.mdg-card-badge {
  display: inline-flex;
  align-self: flex-start;
  margin-top: 0.55rem;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  background: var(--mdg-accent-soft);
  color: var(--mdg-accent);
}
.mdg-card-highlight {
  margin-top: auto;
  padding-top: 0.85rem;
  font-size: 1.45rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}
.mdg-card-fields {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}
.mdg-card-fields li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.78rem;
  border-top: 1px dashed var(--mdg-line);
  padding-top: 0.35rem;
}
.mdg-card-fields .lbl { color: var(--mdg-muted); }
.mdg-card-fields .val { font-weight: 550; text-align: right; }

/* Themes */
.mdg-theme-clean .mdg-card-front {
  background: #fff;
  border: 1px solid var(--mdg-line);
  box-shadow: 0 1px 2px rgb(28 25 23 / 0.04), 0 8px 24px rgb(28 25 23 / 0.05);
}
.mdg-theme-glass .mdg-card-front {
  background: linear-gradient(145deg, rgb(255 255 255 / 0.78), rgb(240 253 250 / 0.55));
  border: 1px solid rgb(255 255 255 / 0.65);
  box-shadow: 0 10px 30px rgb(15 118 110 / 0.12);
  backdrop-filter: blur(10px);
}
.mdg-theme-glass .mdg-card-scene {
  background:
    radial-gradient(120px 80px at 20% 10%, #99f6e4, transparent),
    radial-gradient(140px 100px at 90% 80%, #a5f3fc, transparent);
  border-radius: 18px;
  padding: 0.35rem;
}
.mdg-theme-trading .mdg-card-front {
  background:
    linear-gradient(160deg, #0f172a 0%, #1e293b 55%, #0f766e 140%);
  color: #f8fafc;
  border: 2px solid #fbbf24;
  box-shadow: 0 12px 28px rgb(15 23 42 / 0.28);
}
.mdg-theme-trading .mdg-card-kicker,
.mdg-theme-trading .mdg-card-sub { color: #cbd5e1; }
.mdg-theme-trading .mdg-card-badge {
  background: #fbbf24;
  color: #1c1917;
}
.mdg-theme-trading .mdg-card-fields li { border-top-color: rgb(148 163 184 / 0.35); }
.mdg-theme-trading .mdg-card-fields .lbl { color: #94a3b8; }
.mdg-theme-trading .mdg-card-fields .val { color: #f8fafc; }
.mdg-theme-receipt .mdg-card-front {
  background:
    repeating-linear-gradient(
      0deg,
      #fffbeb 0,
      #fffbeb 28px,
      #fef3c7 28px,
      #fef3c7 29px
    );
  border: 1px dashed #a8a29e;
  border-radius: 4px;
  font-family: var(--mdg-mono);
  box-shadow: 0 6px 0 #d6d3d1;
}
.mdg-theme-receipt .mdg-card-title {
  font-size: 1rem;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.mdg-theme-receipt .mdg-card-sub,
.mdg-theme-receipt .mdg-card-kicker { text-align: center; width: 100%; }
.mdg-theme-receipt .mdg-card-badge {
  align-self: center;
  border-radius: 2px;
  background: transparent;
  border: 1px solid #78716c;
  color: #44403c;
}
.mdg-theme-receipt .mdg-card-highlight {
  text-align: center;
  border-top: 2px dashed #a8a29e;
  border-bottom: 2px dashed #a8a29e;
  margin-top: 0.75rem;
  padding: 0.55rem 0;
}

/* Motion */
@keyframes mdg-card-enter {
  from { opacity: 0; transform: translateY(14px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes mdg-card-swap {
  0% { opacity: 1; transform: scale(1) rotate(0deg); filter: blur(0); }
  40% { opacity: 0; transform: scale(0.94) rotate(-1.5deg); filter: blur(2px); }
  100% { opacity: 1; transform: scale(1) rotate(0deg); filter: blur(0); }
}
@keyframes mdg-count-up {
  from { opacity: 0.35; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.mdg-card-scene.mdg-enter {
  animation: mdg-card-enter 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.mdg-cards-root.is-swapping .mdg-card-scene {
  animation: mdg-card-swap 0.7s ease both;
}
.mdg-card-highlight.mdg-count {
  animation: mdg-count-up 0.6s ease both;
}
.mdg-card-scene:hover .mdg-card-front {
  transform: translateY(-2px);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.mdg-theme-clean .mdg-card-scene:hover .mdg-card-front {
  box-shadow: 0 2px 4px rgb(28 25 23 / 0.06), 0 14px 32px rgb(28 25 23 / 0.1);
}
@media (prefers-reduced-motion: reduce) {
  .mdg-card-flip,
  .mdg-card-scene.mdg-enter,
  .mdg-cards-root.is-swapping .mdg-card-scene,
  .mdg-card-highlight.mdg-count,
  .mdg-card-scene:hover .mdg-card-front {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
}
`.trim()

export function themeClass(theme: CardTheme): string {
  return `mdg-theme-${theme}`
}

export function staggerDelayStyle(index: number): string {
  return `animation-delay: ${Math.min(index, 12) * 55}ms`
}
