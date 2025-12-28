# Mock File Synchronization

Mockifyer provides two sync commands to keep mock files synchronized between your project folder and device/simulator.

## Sync Commands

### 1. Sync FROM Device → Project (`sync:mocks`)

Syncs mock files **from** the device/simulator **to** your project folder. Use this when:
- You've recorded new mocks in the app
- You want to version control the mocks
- You want to view/edit them in the dashboard

```bash
npm run sync:mocks              # Auto-detect device
npm run sync:mocks:ios          # iOS Simulator
npm run sync:mocks:android      # Android Emulator
```

### 2. Sync TO Device (`sync:to-device`)

Syncs mock files **from** your project folder **to** the device/simulator. Use this when:
- You've edited mocks in the dashboard or project folder
- You want to test with updated mock data
- You've pulled new mocks from version control

```bash
npm run sync:to-device          # Auto-detect device
npm run sync:to-device:ios      # iOS Simulator
npm run sync:to-device:android  # Android Emulator
```

## Typical Workflow

### Recording New Mocks

1. **Start app in record mode**: `npm run dev:record`
2. **Use the app** - make API calls that you want to mock
3. **Sync from device**: `npm run sync:mocks`
4. **View in dashboard**: `npm run dashboard`
5. **Commit to git**: `git add mock-data/ && git commit -m "Add new mocks"`

### Updating Existing Mocks

1. **Edit mocks** in dashboard or manually edit JSON files in `./mock-data/`
2. **Sync to device**: `npm run sync:to-device`
3. **Restart app** (or use reload button) to load updated mocks

### Team Collaboration

1. **Pull changes**: `git pull`
2. **Sync to device**: `npm run sync:to-device`
3. **Restart app** to use updated mocks

## Requirements

### iOS Simulator
- ✅ macOS
- ✅ Xcode installed
- ✅ Simulator booted and running
- ✅ App must have been run at least once

### Android Emulator
- ✅ Android SDK installed
- ✅ `adb` in PATH
- ✅ Emulator running
- ✅ App must have been run at least once

## Troubleshooting

### "No booted simulator found"
- Make sure your iOS Simulator is running
- Run your app at least once to create the app data directory

### "adb not found"
- Install Android SDK
- Add `adb` to your PATH

### "Source directory not found"
- Make sure `./mock-data/` exists
- Or specify custom path with `--path`

### "No files were synced"
- Check that you have `.json` files in the mock-data directory
- Verify file permissions
- Make sure the app has created mocks (run in record mode first)

## Related

- See `HOT_RELOAD.md` for automatic file watching (no restart needed!)
- See `DASHBOARD.md` for viewing and editing mock files



