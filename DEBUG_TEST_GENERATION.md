# Debugging Test Generation in React Native

## Steps to Debug

### 1. Rebuild the Package

The `mockifyer-fetch` package needs to be rebuilt with the latest changes:

```bash
cd packages/mockifyer-fetch
npm run build
```

### 2. Check Console Logs

When you make an API call in your React Native app, you should see these logs in Metro:

```
[Mockifyer-Fetch] ✅ Successfully saved mock using provider
[Mockifyer-Fetch] 🔧 Test generation enabled, attempting to generate test...
[Mockifyer-Fetch] 🔧 Test generator available: true
[Mockifyer-Fetch] 🔧 fs available: true
[Mockifyer-Fetch] 🔧 path available: true
[Mockifyer] 📝 Test generation options: {...}
[Mockifyer] 📝 Generated test file path: ...
[Mockifyer] 📝 Resolved absolute path: ...
[Mockifyer] 📝 Final absolute test path: ...
[Mockifyer] 📝 Test directory: ...
[Mockifyer] ✅ Generated test: ...
```

### 3. Check What's Happening

**If you see:**
- `Test generator available: false` → Test generator not initialized
- `fs available: false` → fs module not available (should be available in Metro)
- `path available: false` → path module not available (should be available in Metro)
- `Test generation skipped: fs/path not available` → Modules couldn't be required

**If you see errors:**
- Check the error message and stack trace
- Common issues:
  - Permission errors writing to test directory
  - Path resolution issues
  - Missing test generator module

### 4. Verify Configuration

Check your `mockifyer-setup.ts`:

```typescript
generateTests: {
  enabled: true,  // ✅ Must be true
  framework: 'jest',
  outputPath: './tests/generated',  // ✅ Relative to project root
  groupBy: 'endpoint'
}
```

### 5. Check Output Path

The output path should be relative to your project root (where Metro runs):

```typescript
outputPath: './tests/generated'  // ✅ Correct - relative to project root
```

NOT:
```typescript
outputPath: 'mock-data'  // ❌ Wrong - this is device path
outputPath: '/tests/generated'  // ❌ Wrong - absolute path might not work
```

### 6. Verify Recording Mode

Make sure recording is enabled:

```bash
MOCKIFYER_ENABLED=true MOCKIFYER_RECORD=true npm start
```

### 7. Check File System Access

In Metro (Node.js), `fs` and `path` should be available. If they're not:

1. Check if you're running in Metro bundler (not on device)
2. Test generation happens in Metro, not on device
3. Files are written to your development machine, not device

### 8. Manual Test

Try this in your React Native app:

```typescript
// Make an API call
const response = await fetch('https://api.example.com/users/1');
const data = await response.json();

// Check console for test generation logs
// Check if file exists:
// ls -la tests/generated/
```

### 9. Common Issues

#### Issue: No logs at all
**Cause**: Test generation not enabled or not triggered
**Solution**: Check `generateTests.enabled: true` and ensure mocks are being saved

#### Issue: fs/path not available
**Cause**: Running on device instead of Metro
**Solution**: Test generation only works in Metro bundler (Node.js), not on device

#### Issue: Path resolution wrong
**Cause**: Output path not resolving correctly
**Solution**: Use `./tests/generated` (relative to project root)

#### Issue: Permission errors
**Cause**: Can't write to test directory
**Solution**: Check directory permissions, ensure project folder is writable

### 10. Expected Behavior

1. **Mock saved** → Device filesystem (via expo-filesystem provider)
2. **Test generated** → Project folder (via Node.js fs in Metro)
3. **Files appear** → `./tests/generated/` folder in your project

## Next Steps

1. Rebuild: `cd packages/mockifyer-fetch && npm run build`
2. Restart Metro: Stop and restart `npm start`
3. Make API call: Trigger a fetch request
4. Check logs: Look for test generation logs in Metro console
5. Check files: `ls -la tests/generated/`

If still not working, share the console logs and we can debug further!

