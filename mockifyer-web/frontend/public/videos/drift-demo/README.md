# Drift Detection Demo Assets

This directory contains video and GIF assets for the drift detection guide.

## Files to Create

After recording the drift demo from `demos/drift-live/`, place the files here:

1. **drift-workflow-demo.mp4** (< 5 MB)
   - Screen recording of the CLI demo workflow
   - Shows: check v1 → switch to v2 → detect drift → accept → verify

2. **drift-workflow-demo.gif** (< 5 MB)  
   - Animated GIF version for quick preview
   - Same content as mp4, optimized for web

## Recording Instructions

### Option 1: Terminal Recording (Recommended)

```bash
cd demos/drift-live

# Record with asciinema
asciinema rec drift-demo.cast --idle-time-limit 2
npm run cli-demo
# Ctrl+D to stop

# Convert to GIF with agg
agg drift-demo.cast drift-workflow-demo.gif --speed 1.5 --cols 120 --rows 30

# Convert to mp4 (if needed)
# Use svg-term to render, then ffmpeg to convert
```

### Option 2: Screen Recording

Use OBS Studio, QuickTime, or similar to record the terminal during `npm run cli-demo`.

**Settings**:
- Resolution: 1280x720 or 1920x1080
- Frame rate: 30fps
- Format: H.264 mp4
- Target size: < 5 MB

**Post-processing**:
```bash
# Compress mp4 if needed
ffmpeg -i drift-demo-raw.mp4 -c:v libx264 -crf 28 -preset slow drift-workflow-demo.mp4

# Create GIF from mp4
ffmpeg -i drift-workflow-demo.mp4 -vf "fps=10,scale=1280:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" -loop 0 drift-workflow-demo.gif
```

## File Paths (for integration)

Once created, these files will be served at:

- **MP4**: `/videos/drift-demo/drift-workflow-demo.mp4`
- **GIF**: `/videos/drift-demo/drift-workflow-demo.gif`

## Integration Code

To replace the placeholder in `MockDrift.tsx` (PR #524), use:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Demo: Full Workflow</CardTitle>
    <CardDescription>
      See drift detection in action with a simulated API change
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      <video 
        controls 
        className="w-full rounded-lg border"
        poster="/videos/drift-demo/drift-workflow-demo.gif"
      >
        <source src="/videos/drift-demo/drift-workflow-demo.mp4" type="video/mp4" />
        <img 
          src="/videos/drift-demo/drift-workflow-demo.gif" 
          alt="Drift detection workflow demo"
          className="w-full"
        />
      </video>
      <p className="text-sm text-muted-foreground">
        This demo shows: ✓ v1 check (pass) → 🔄 switch to v2 → ✗ drift detected → 
        📝 accept live → ✓ verify (pass)
      </p>
    </div>
  </CardContent>
</Card>
```

Or for a simpler GIF-only embed:

```tsx
<div className="my-6 rounded-lg border overflow-hidden">
  <img 
    src="/videos/drift-demo/drift-workflow-demo.gif" 
    alt="Drift detection CLI workflow"
    className="w-full"
  />
  <div className="p-4 bg-muted">
    <p className="text-sm">
      Demo: Check v1 (✓) → Switch to v2 → Detect drift (✗) → Accept changes → Verify (✓)
    </p>
  </div>
</div>
```
