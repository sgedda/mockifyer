# Adding Content to mockifyer.dev

This document explains how to add new guides and comparison pages to the Mockifyer website.

## Single Source of Truth

All content pages (guides and comparisons) are registered in **one place**:

```
mockifyer-web/frontend/src/lib/content-registry.ts
```

When you add an entry there, the following are **automatically generated**:

1. **Route** — added to App.tsx routing
2. **SEO metadata** — title, description, and canonical URL
3. **Sitemap entry** — appears in `public/sitemap.xml`
4. **Prerender target** — static HTML generated at build time
5. **Hub listing** — appears on `/guides` or in the comparisons hub section

## Adding a New Guide

### Step 1: Add entry to content-registry.ts

Open `mockifyer-web/frontend/src/lib/content-registry.ts` and add an entry to the `GUIDES` array:

```typescript
{
  path: '/guides/my-new-guide',
  title: 'My New Guide Title',
  summary: 'One-line summary for the /guides index page.',
  seoTitle: 'My New Guide Title', // Optional, defaults to title
  seoDescription: 'SEO description (max 155 chars) for search engines.',
  type: 'guide',
  priority: 0.7, // Sitemap priority (0.0 to 1.0)
  changefreq: 'monthly', // Sitemap changefreq
  exists: true, // Set to false for upcoming/draft pages
}
```

**Important fields:**
- `path` — must start with `/guides/`
- `title` — displayed on the hub page and as the page heading
- `summary` — one-line description shown on `/guides`
- `seoDescription` — **max 155 characters** for Google snippets
- `exists` — set to `false` for upcoming pages (they won't appear in routes/sitemap)

### Step 2: Create the page component

Create a new file at `mockifyer-web/frontend/src/pages/guides/MyNewGuide.tsx`:

```tsx
export default function MyNewGuide() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-4xl font-bold mb-4">My New Guide Title</h1>
      <p className="text-muted-foreground mb-8">
        Your guide content here...
      </p>
      {/* More content */}
    </div>
  )
}
```

### Step 3: Add route to App.tsx

Import the component and add a route:

```tsx
// At the top with other lazy imports
const MyNewGuide = lazy(() => import('./pages/guides/MyNewGuide'))

// In the Routes section
<Route path="/guides/my-new-guide" element={<MyNewGuide />} />
```

### Step 4: Rebuild and test

```bash
cd mockifyer-web
npm run generate:sitemap  # Regenerate sitemap
npm run dev:frontend      # Test locally
```

The guide will now appear:
- On `/guides` index page
- In the navigation dropdown under "Guides"
- In `sitemap.xml`
- In the footer

## Adding a New Comparison Page

Same process as guides, but add to the `COMPARISONS` array in `content-registry.ts`:

```typescript
{
  path: '/comparisons/tool-name',
  title: 'Mockifyer vs Tool Name',
  summary: 'Brief comparison summary for the hub.',
  seoDescription: 'SEO description comparing Mockifyer with Tool Name.',
  type: 'comparison',
  priority: 0.7,
  changefreq: 'monthly',
  exists: true,
}
```

Then create the component at `mockifyer-web/frontend/src/pages/comparisons/ToolName.tsx` and add the route.

**The new comparison will automatically appear** in the "Detailed Comparisons" section on `/comparisons`.

## Upcoming/Draft Pages

If Content Writer is drafting a page that isn't ready yet:

1. Add the entry to `content-registry.ts` with `exists: false`
2. **Do not** create the component or add a route yet

The entry will be in the registry for planning, but won't generate routes, sitemap entries, or appear on hub pages.

When the page is ready:

1. Set `exists: true` in the registry
2. Create the component
3. Add the route to App.tsx
4. Run `npm run generate:sitemap`

## Regenerating llms-full.txt and llms.txt

After adding new pages, regenerate the LLM context files:

```bash
cd mockifyer-web
npm run generate:llms  # If this script exists
```

Or update them manually to include:
- The new guide/comparison page URLs
- Key content excerpts for AI assistants

The llms files should include:
- `/packages` and package descriptions
- All `/guides/*` pages with summaries
- All `/comparisons/*` pages with summaries

## Testing Checklist

Before pushing:

- [ ] Entry added to `content-registry.ts` with correct fields
- [ ] Component created with heading and content
- [ ] Route added to `App.tsx`
- [ ] Page loads at the correct URL locally
- [ ] Page appears on `/guides` or `/comparisons` hub
- [ ] `sitemap.xml` includes the new page (run `npm run generate:sitemap`)
- [ ] SEO title and description are correct (check in DevTools)
- [ ] E2E tests pass (run `npm run test:e2e`)
- [ ] Production build succeeds (run `npm run build:frontend`)

## File Locations Reference

```
mockifyer-web/
├── frontend/
│   └── src/
│       ├── lib/
│       │   ├── content-registry.ts       ← Add entries here
│       │   └── seo.ts                    ← SEO config
│       ├── pages/
│       │   ├── Guides.tsx                ← Hub page for /guides
│       │   ├── Comparisons.tsx           ← Hub page for /comparisons
│       │   ├── guides/
│       │   │   ├── MyNewGuide.tsx        ← Create guide components here
│       │   │   └── ...
│       │   └── comparisons/
│       │       ├── ToolName.tsx          ← Create comparison components here
│       │       └── ...
│       ├── App.tsx                       ← Add routes here
│       └── components/
│           ├── Navigation.tsx            ← Links guides dropdown
│           └── Footer.tsx                ← Links footer guides section
├── scripts/
│   ├── generate-sitemap.ts               ← Reads content-registry
│   └── prerender.ts                      ← Reads content-registry
└── CONTENT.md                            ← This file
```

## Notes

- **Do not manually edit `sitemap.xml`** — it's generated from `content-registry.ts`
- **Keep summaries short** — one sentence, ~80-120 chars
- **SEO descriptions** — max 155 chars, include primary keyword
- **Titles without suffix** — The "| Mockifyer" suffix is added automatically
- **No empty pages may ship** — always set `exists: false` for upcoming pages
