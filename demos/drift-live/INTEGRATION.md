# Drift Demo Integration Guide

This document provides the exact asset paths and code snippets for integrating the drift demo video/GIF into the guide (PR #524).

## Asset Locations

### Where to Place Files

After recording the CLI demo, place the files at:

```
mockifyer-web/frontend/public/videos/drift-demo/
├── README.md                    # Recording instructions (committed)
├── drift-workflow-demo.mp4      # Video file (< 5 MB, to be created)
└── drift-workflow-demo.gif      # GIF file (< 5 MB, to be created)
```

### Public URLs

Once deployed, files will be served at:

- **MP4**: `/videos/drift-demo/drift-workflow-demo.mp4`
- **GIF**: `/videos/drift-demo/drift-workflow-demo.gif`

## Recording the Demo

### Quick Start

```bash
cd demos/drift-live
npm install
npm run cli-demo  # This is what to record
```

### Recommended: Terminal Recording with asciinema

```bash
# Record terminal session
asciinema rec drift-demo.cast --idle-time-limit 2
npm run cli-demo
# Press Ctrl+D to stop

# Convert to GIF (requires agg: cargo install agg)
agg drift-demo.cast drift-workflow-demo.gif \
  --speed 1.5 \
  --cols 120 \
  --rows 30 \
  --theme monokai

# Convert to mp4 (via svg-term + ffmpeg)
svg-term --cast drift-demo.cast --out drift-demo.svg --width 120 --height 30
# Then use ffmpeg or online converter to create mp4
```

### Alternative: Screen Recording

Use OBS Studio, QuickTime, or similar:

1. Set terminal to 120 cols × 30 rows (or similar readable size)
2. Use a dark theme with good contrast
3. Record at 1280×720 or 1920×1080
4. Export as H.264 mp4, target < 5 MB

**Compress if needed:**

```bash
ffmpeg -i drift-demo-raw.mp4 -c:v libx264 -crf 28 -preset slow \
  -vf "scale=1280:-2" drift-workflow-demo.mp4

# Verify size
ls -lh drift-workflow-demo.mp4  # Should be < 5 MB
```

### Create GIF from Video

```bash
# High-quality GIF with palette
ffmpeg -i drift-workflow-demo.mp4 \
  -vf "fps=10,scale=1280:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" \
  -loop 0 \
  drift-workflow-demo.gif

# Optimize if > 5 MB
gifsicle -O3 --lossy=80 drift-workflow-demo.gif -o drift-workflow-demo.gif
```

## Integration Code for MockDrift.tsx (PR #524)

### Replace the Placeholder

Find this comment in `mockifyer-web/frontend/src/pages/guides/MockDrift.tsx`:

```tsx
{/* TODO: Drift tab demo video placeholder - to be added by demos/drift-live agent */}
```

### Option 1: Video with GIF Fallback (Recommended)

Replace the placeholder with:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Play className="h-5 w-5" />
      Demo: Full Workflow
    </CardTitle>
    <CardDescription>
      See drift detection in action with a simulated API change
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      <video 
        controls 
        className="w-full rounded-lg border shadow-sm"
        poster="/videos/drift-demo/drift-workflow-demo.gif"
      >
        <source src="/videos/drift-demo/drift-workflow-demo.mp4" type="video/mp4" />
        <img 
          src="/videos/drift-demo/drift-workflow-demo.gif" 
          alt="Drift detection workflow demo"
          className="w-full"
        />
      </video>
      <div className="text-sm text-muted-foreground space-y-1">
        <p><strong>Workflow shown:</strong></p>
        <ol className="list-decimal list-inside pl-2 space-y-1">
          <li>✓ Check v1 API → All green</li>
          <li>🔄 Switch backend to v2 (breaking changes)</li>
          <li>✗ Detect drift → Breaking changes found</li>
          <li>📝 Accept live response for affected endpoint</li>
          <li>✓ Verify resolution → All green</li>
        </ol>
        <p className="pt-2">
          <Link to="/demos/drift-live" className="text-blue-600 hover:underline">
            Try the demo yourself →
          </Link>
        </p>
      </div>
    </div>
  </CardContent>
</Card>
```

**Required imports** (if not already present):

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Play } from 'lucide-react'
import { Link } from 'react-router-dom'
```

### Option 2: GIF-Only Embed (Simpler)

For a lighter-weight option without video controls:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Demo: Drift Detection Workflow</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="rounded-lg border overflow-hidden">
      <img 
        src="/videos/drift-demo/drift-workflow-demo.gif" 
        alt="Drift detection CLI workflow: check v1 (pass) → switch to v2 → detect drift (fail) → accept changes → verify (pass)"
        className="w-full"
      />
      <div className="p-4 bg-muted">
        <p className="text-sm">
          <strong>Demo flow:</strong> ✓ Check v1 (pass) → 🔄 Switch to v2 → 
          ✗ Detect drift (fail) → 📝 Accept changes → ✓ Verify (pass)
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Run this demo yourself: <code className="bg-background px-1.5 py-0.5 rounded">cd demos/drift-live && npm run cli-demo</code>
        </p>
      </div>
    </div>
  </CardContent>
</Card>
```

### Option 3: Inline GIF (Minimal)

For the most compact integration:

```tsx
<div className="my-6">
  <img 
    src="/videos/drift-demo/drift-workflow-demo.gif" 
    alt="Drift detection workflow demo"
    className="w-full rounded-lg border shadow-sm"
  />
  <p className="text-sm text-muted-foreground text-center mt-2">
    Full drift detection workflow: check → detect → accept → verify
  </p>
</div>
```

## File Checklist

Before merging both PRs:

- [ ] Record CLI demo (`demos/drift-live/cli-demo.sh`)
- [ ] Create `drift-workflow-demo.mp4` (< 5 MB)
- [ ] Create `drift-workflow-demo.gif` (< 5 MB)
- [ ] Place files in `mockifyer-web/frontend/public/videos/drift-demo/`
- [ ] Commit files (force-add since public/ is gitignored)
- [ ] Replace placeholder in `MockDrift.tsx` with chosen option
- [ ] Test video loads in development (`npm run dev`)
- [ ] Verify both PRs are merged before deployment

## Notes

- **Video should show**: Terminal output with color codes, the full workflow, and clear results
- **Keep it short**: Aim for 30-60 seconds total
- **File size matters**: Both files must be < 5 MB for fast loading
- **Accessibility**: Include descriptive alt text and captions in the UI
- **Fallback**: The GIF acts as both poster image and fallback for browsers without video support

## Related Files

- Demo source: `demos/drift-live/`
- CLI script: `demos/drift-live/cli-demo.sh`
- Asset directory: `mockifyer-web/frontend/public/videos/drift-demo/`
- Guide file: `mockifyer-web/frontend/src/pages/guides/MockDrift.tsx` (PR #524)
