/**
 * Lightweight JSON / curl syntax highlighting for Atlas HTML pages
 * (trace replay + live stream analyze panel). No CDN — spans only.
 */

export type AtlasCodeHighlightKind = 'json' | 'curl' | 'auto' | 'plain';

/** CSS custom properties + token classes (light + dark via data-theme). */
export const ATLAS_CODE_HIGHLIGHT_CSS = `
:root {
  --code-key: #0b6e99;
  --code-str: #a15c2f;
  --code-num: #2f6b3a;
  --code-bool: #3b5bdb;
  --code-null: #5c6bc0;
  --code-cmd: #0f6b5c;
  --code-flag: #8a5a00;
  --code-url: #0b6e99;
  --code-punct: #6b6458;
}
html[data-theme="dark"] {
  --code-key: #9cdcfe;
  --code-str: #ce9178;
  --code-num: #b5cea8;
  --code-bool: #569cd6;
  --code-null: #569cd6;
  --code-cmd: #5dff9a;
  --code-flag: #ffd60a;
  --code-url: #9cdcfe;
  --code-punct: #5e8f6a;
}
pre.code .json-k, .json-k { color: var(--code-key); }
pre.code .json-s, .json-s { color: var(--code-str); }
pre.code .json-n, .json-n { color: var(--code-num); }
pre.code .json-b, .json-b { color: var(--code-bool); }
pre.code .json-null, .json-null { color: var(--code-null); }
pre.code .curl-cmd, .curl-cmd { color: var(--code-cmd); font-weight: 650; }
pre.code .curl-flag, .curl-flag { color: var(--code-flag); }
pre.code .curl-str, .curl-str { color: var(--code-str); }
pre.code .curl-url, .curl-url { color: var(--code-url); }
pre.code .curl-punct, .curl-punct { color: var(--code-punct); }
`.trim();

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function looksLikeJsonish(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    (t.charAt(0) === '{' && t.charAt(t.length - 1) === '}') ||
    (t.charAt(0) === '[' && t.charAt(t.length - 1) === ']')
  );
}

/**
 * Highlight pretty-printed JSON (same token classes as saved Atlas HTML).
 */
export function highlightJsonHtml(prettyText: string): string {
  if (prettyText == null || prettyText === '') return '';
  const s = String(prettyText);
  let out = '';
  let i = 0;

  const escSlice = (from: number, to: number): string => escapeHtml(s.slice(from, to));

  while (i < s.length) {
    const ch = s.charAt(i);
    if (ch === '"') {
      let j = i + 1;
      while (j < s.length) {
        if (s.charAt(j) === '\\') {
          j += 2;
          continue;
        }
        if (s.charAt(j) === '"') {
          j += 1;
          break;
        }
        j += 1;
      }
      const strHtml = escSlice(i, j);
      let k = j;
      while (k < s.length && (s.charAt(k) === ' ' || s.charAt(k) === '\t')) k += 1;
      if (s.charAt(k) === ':') {
        out += `<span class="json-k">${strHtml}</span>`;
      } else {
        out += `<span class="json-s">${strHtml}</span>`;
      }
      i = j;
      continue;
    }
    if (ch === 't' && s.slice(i, i + 4) === 'true') {
      out += '<span class="json-b">true</span>';
      i += 4;
      continue;
    }
    if (ch === 'f' && s.slice(i, i + 5) === 'false') {
      out += '<span class="json-b">false</span>';
      i += 5;
      continue;
    }
    if (ch === 'n' && s.slice(i, i + 4) === 'null') {
      out += '<span class="json-null">null</span>';
      i += 4;
      continue;
    }
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      let n = i + 1;
      while (n < s.length) {
        const c = s.charAt(n);
        if (
          (c >= '0' && c <= '9') ||
          c === '.' ||
          c === 'e' ||
          c === 'E' ||
          c === '+' ||
          c === '-'
        ) {
          n += 1;
        } else {
          break;
        }
      }
      out += `<span class="json-n">${escSlice(i, n)}</span>`;
      i = n;
      continue;
    }
    out += escSlice(i, i + 1);
    i += 1;
  }
  return out;
}

/**
 * Highlight a multiline curl command (flags, quoted args, URLs).
 */
export function highlightCurlHtml(text: string): string {
  if (text == null || text === '') return '';
  const s = String(text);
  let out = '';
  let i = 0;

  const isBoundary = (idx: number): boolean =>
    idx <= 0 || /\s/.test(s.charAt(idx - 1)) || s.charAt(idx - 1) === '\\';

  while (i < s.length) {
    const ch = s.charAt(i);

    if (ch === "'") {
      let j = i + 1;
      while (j < s.length) {
        // shellQuote embeds '\'' for literal quotes
        if (s.slice(j, j + 4) === "'\\''") {
          j += 4;
          continue;
        }
        if (s.charAt(j) === "'") {
          j += 1;
          break;
        }
        j += 1;
      }
      const raw = s.slice(i, j);
      const inner = raw.length >= 2 ? raw.slice(1, -1) : '';
      const cls =
        /^https?:\/\//i.test(inner) || /^[a-z][a-z0-9+.-]*:\/\//i.test(inner)
          ? 'curl-url'
          : 'curl-str';
      out += `<span class="${cls}">${escapeHtml(raw)}</span>`;
      i = j;
      continue;
    }

    if (ch === '-' && isBoundary(i)) {
      let j = i;
      while (j < s.length && !/\s/.test(s.charAt(j)) && s.charAt(j) !== '\\') {
        j += 1;
      }
      out += `<span class="curl-flag">${escapeHtml(s.slice(i, j))}</span>`;
      i = j;
      continue;
    }

    if (
      isBoundary(i) &&
      s.slice(i, i + 4) === 'curl' &&
      (i + 4 >= s.length || /\s/.test(s.charAt(i + 4)))
    ) {
      out += '<span class="curl-cmd">curl</span>';
      i += 4;
      continue;
    }

    if (ch === '\\' && (i + 1 >= s.length || s.charAt(i + 1) === '\n')) {
      out += `<span class="curl-punct">${escapeHtml(ch)}</span>`;
      i += 1;
      continue;
    }

    out += escapeHtml(ch);
    i += 1;
  }
  return out;
}

/**
 * Highlight code for Atlas panels. Copy via `pre.textContent` still yields plain text.
 */
export function highlightAtlasCode(
  text: string,
  kind: AtlasCodeHighlightKind = 'auto',
): string {
  const raw = String(text ?? '');
  if (kind === 'plain') return escapeHtml(raw);
  if (kind === 'curl' || (kind === 'auto' && /^\s*curl\b/m.test(raw))) {
    return highlightCurlHtml(raw);
  }
  if (kind === 'json' || (kind === 'auto' && looksLikeJsonish(raw))) {
    return highlightJsonHtml(raw);
  }
  return escapeHtml(raw);
}

/**
 * Browser-side copy of the highlighters for the live stream page
 * (keep algorithms aligned with the TypeScript exports above).
 */
export function atlasSyntaxHighlightInlineScript(): string {
  return `
  function escHighlight(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function looksLikeJsonish(text) {
    var t = String(text || "").replace(/^\\s+|\\s+$/g, "");
    if (!t) return false;
    return (
      (t.charAt(0) === "{" && t.charAt(t.length - 1) === "}") ||
      (t.charAt(0) === "[" && t.charAt(t.length - 1) === "]")
    );
  }
  function highlightJsonHtml(prettyText) {
    if (prettyText == null || prettyText === "") return "";
    var s = String(prettyText);
    var out = "";
    var i = 0;
    function escSlice(from, to) { return escHighlight(s.slice(from, to)); }
    while (i < s.length) {
      var ch = s.charAt(i);
      if (ch === '"') {
        var j = i + 1;
        while (j < s.length) {
          if (s.charAt(j) === String.fromCharCode(92)) { j += 2; continue; }
          if (s.charAt(j) === '"') { j += 1; break; }
          j += 1;
        }
        var strHtml = escSlice(i, j);
        var k = j;
        while (k < s.length && (s.charAt(k) === " " || s.charAt(k) === String.fromCharCode(9))) k += 1;
        out += s.charAt(k) === ":"
          ? '<span class="json-k">' + strHtml + "</span>"
          : '<span class="json-s">' + strHtml + "</span>";
        i = j;
        continue;
      }
      if (ch === "t" && s.slice(i, i + 4) === "true") {
        out += '<span class="json-b">true</span>'; i += 4; continue;
      }
      if (ch === "f" && s.slice(i, i + 5) === "false") {
        out += '<span class="json-b">false</span>'; i += 5; continue;
      }
      if (ch === "n" && s.slice(i, i + 4) === "null") {
        out += '<span class="json-null">null</span>'; i += 4; continue;
      }
      if (ch === "-" || (ch >= "0" && ch <= "9")) {
        var n = i + 1;
        while (n < s.length) {
          var c = s.charAt(n);
          if ((c >= "0" && c <= "9") || c === "." || c === "e" || c === "E" || c === "+" || c === "-") n += 1;
          else break;
        }
        out += '<span class="json-n">' + escSlice(i, n) + "</span>";
        i = n;
        continue;
      }
      out += escSlice(i, i + 1);
      i += 1;
    }
    return out;
  }
  function highlightCurlHtml(text) {
    if (text == null || text === "") return "";
    var s = String(text);
    var out = "";
    var i = 0;
    function isBoundary(idx) {
      return idx <= 0 || /\\s/.test(s.charAt(idx - 1)) || s.charAt(idx - 1) === String.fromCharCode(92);
    }
    while (i < s.length) {
      var ch = s.charAt(i);
      if (ch === "'") {
        var j = i + 1;
        while (j < s.length) {
          if (s.slice(j, j + 4) === "'\\\\''") { j += 4; continue; }
          if (s.charAt(j) === "'") { j += 1; break; }
          j += 1;
        }
        var raw = s.slice(i, j);
        var inner = raw.length >= 2 ? raw.slice(1, -1) : "";
        var cls = /^https?:\\/\\//i.test(inner) ? "curl-url" : "curl-str";
        out += '<span class="' + cls + '">' + escHighlight(raw) + "</span>";
        i = j;
        continue;
      }
      if (ch === "-" && isBoundary(i)) {
        var fj = i;
        while (fj < s.length && !/\\s/.test(s.charAt(fj)) && s.charAt(fj) !== String.fromCharCode(92)) fj += 1;
        out += '<span class="curl-flag">' + escHighlight(s.slice(i, fj)) + "</span>";
        i = fj;
        continue;
      }
      if (isBoundary(i) && s.slice(i, i + 4) === "curl" && (i + 4 >= s.length || /\\s/.test(s.charAt(i + 4)))) {
        out += '<span class="curl-cmd">curl</span>';
        i += 4;
        continue;
      }
      if (ch === String.fromCharCode(92) && (i + 1 >= s.length || s.charAt(i + 1) === String.fromCharCode(10))) {
        out += '<span class="curl-punct">' + escHighlight(ch) + "</span>";
        i += 1;
        continue;
      }
      out += escHighlight(ch);
      i += 1;
    }
    return out;
  }
  function highlightAtlasCode(text, kind) {
    var raw = String(text == null ? "" : text);
    var mode = kind || "auto";
    if (mode === "plain") return escHighlight(raw);
    if (mode === "curl" || (mode === "auto" && /^\\s*curl\\b/m.test(raw))) {
      return highlightCurlHtml(raw);
    }
    if (mode === "json" || (mode === "auto" && looksLikeJsonish(raw))) {
      return highlightJsonHtml(raw);
    }
    return escHighlight(raw);
  }
  function setAnalyzeContent(text, kind) {
    analyzeEl.innerHTML = highlightAtlasCode(text, kind || "auto");
    analyzeEl.classList.add("show");
  }
`.trim();
}
