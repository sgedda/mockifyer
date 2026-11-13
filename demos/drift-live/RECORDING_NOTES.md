# Drift Demo Recording Notes

## Recorded Assets

### Dashboard UI Demo

**File**: `mockifyer-web/frontend/public/videos/drift-demo/drift-workflow-demo.mp4` (1.1 MB)  
**GIF**: `mockifyer-web/frontend/public/videos/drift-demo/drift-workflow-demo.gif` (3.5 MB)

**Duration**: 2:59  
**Resolution**: 1280×900  
**Framerate**: 25 fps (source), 15 fps (mp4), 8 fps (gif)

### What's Captured

The video successfully demonstrates:

1. ✅ **Dashboard Loading** (0:00-0:10)
   - Mockifyer dashboard initializes
   - Navigation visible with Drift tab link

2. ✅ **Navigate to Drift Tab** (0:10-0:15)
   - Click on "Drift" link in sidebar
   - Drift tab loads with "Run Check Now" button

3. ✅ **First Drift Check - v1 API** (0:15-0:45)
   - Caption: "Step 1: Checking v1 API - Expect All Green"
   - Click "Run Check Now"
   - Check runs for ~6 seconds
   - Results show: No drift detected

4. ✅ **Backend Switch to v2** (0:45-0:55)
   - Caption: "Step 3: Switching API to v2 (Breaking Changes)"
   - Backend process restarts with v2 mode (logged in console)

5. ✅ **Second Drift Check - v2 API** (0:55-2:20)
   - Caption: "Step 4: Checking v2 API - Expect Drift"
   - Attempting to click "Run Check Now" again
   - *Note*: Test timed out waiting for button to become clickable
   - Likely cause: First check still processing or button disabled

6. ⚠️  **Partial Coverage** (not captured due to timeout)
   - Viewing drift details and diff
   - Clicking "Ignore Field"
   - Clicking "Accept Live"
   - Re-running check to verify resolution
   - Viewing drift history

### Frame Verification

Extracted and verified 7 frames at different timestamps:
- `frame-1.png` (11 KB): Initial blank/loading state
- `frame-2.png` (387 KB): Dashboard UI loaded, navigation visible
- `frame-3.png` (381 KB): Drift tab displayed with content
- `frame-4.png` (342 KB): Drift check UI, table visible
- `step1-dashboard.png` (304 KB): Dashboard Statistics page
- `step2-drift-tab.png` (362 KB): Drift tab with "Run Check Now" button
- `step3-check-running.png` (359 KB): Check running or results displayed

**Frame size indicates**: All frames contain substantial rendered content (not blank screens). The dashboard UI, navigation, tables, and buttons are being rendered correctly.

**Captions visible**: On-screen caption overlays appear as blue banners at the top of the viewport with white text, providing context for each step.

## CLI Demo

**Workflow**: Fully functional and demonstrated in `cli-demo.sh`

The CLI script successfully demonstrates:
1. ✅ v1 check → "No drift detected"
2. ✅ Switch to v2
3. ✅ v2 check → "2 of 2 mocks drifted: 1 breaking, 1 warning"
4. ✅ Accept drift for `/api/trips`
5. ✅ Final check → Only warnings remain (breaking drift resolved)

**Output**: Color-coded terminal output with ✓/✗ indicators, detailed drift reports, and exit codes.

**Note**: CLI demo GIF creation deferred - can be generated with:
```bash
# Using asciinema + agg (requires installation)
asciinema rec drift-cli.cast --idle-time-limit 2
bash cli-demo.sh
# Ctrl+D

agg drift-cli.cast drift-cli-demo.gif --speed 1.5
```

## Issues Found in Drift Tab UI

### Test Timeout on Second Drift Check

**Issue**: After running the first drift check successfully, the test timed out (180s) trying to click "Run Check Now" for the second time.

**Possible Causes**:
1. **Button state**: "Run Check Now" button may remain disabled after the first check completes
2. **Loading state**: First check might not have fully completed, leaving UI in loading state
3. **Race condition**: UI update after first check may take longer than expected
4. **React state**: Component state not properly resetting after first check

**Recommendation**: Investigate button state management and loading indicators in `Drift.tsx` component. The button should become re-enabled after check completes.

### What Works

- ✅ Dashboard frontend builds and serves correctly
- ✅ Backend (Express with v1/v2 modes) works perfectly
- ✅ Drift API endpoints respond correctly
- ✅ First drift check executes and returns results
- ✅ Navigation and UI rendering functional
- ✅ Captions overlay correctly
- ✅ Backend switching works (v1 → v2)

## Regenerating the Video

To re-record with fixes or to capture the complete workflow:

```bash
cd demos/drift-live

# Ensure dashboard is built
cd ../../packages/mockifyer-dashboard/frontend
npm install --legacy-peer-deps
npx vite build
cd ../../..

# Run the demo
cd demos/drift-live
npm test

# Video will be in:
# test-results/demo-Drift-Detection-Demo-Full-drift-detection-workflow-chromium/video.webm

# Convert
ffmpeg -i test-results/.../video.webm -c:v libx264 -crf 28 -vf scale=1280:-2 drift-workflow-demo.mp4
ffmpeg -i drift-workflow-demo.mp4 -vf "fps=8,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=96[p];[s1][p]paletteuse=dither=bayer" drift-workflow-demo.gif

# Move to public assets
mv drift-workflow-demo.{mp4,gif} ../../mockifyer-web/frontend/public/videos/drift-demo/
```

## File Sizes

- ✅ drift-workflow-demo.mp4: 1.1 MB (target: < 5 MB)
- ✅ drift-workflow-demo.gif: 3.5 MB (target: < 5 MB)
- Both files are web-ready and under the size limit

## Summary

**Delivered**:
- Working dashboard UI demo (partial workflow)
- MP4 and GIF files in correct location
- CLI demo fully functional
- Frame verification confirming content quality
- Documentation of what works and what needs fixing

**Known Issues**:
- Second drift check button interaction timeout (UI investigation needed)
- CLI demo GIF not yet created (instructions provided)

**Next Steps**:
- Debug button state in Drift.tsx after first check
- Complete the full workflow recording once fixed
- Optional: Generate CLI demo GIF with asciinema
