# Runtime Toggle: Enable/Disable Mockifyer

This feature allows you to completely enable or disable Mockifyer at runtime in your React Native or web application. When disabled, all HTTP requests bypass Mockifyer completely:

- ❌ No mock lookup
- ❌ No recording
- ❌ No dashboard connections
- ❌ No Redis connections
- ❌ No proxy requests
- ✅ Direct API calls only

## Use Cases

- **Development debugging**: Quickly switch between mocked and real API to verify behavior
- **Testing**: Compare mocked vs real responses
- **User settings**: Let users toggle mocking in development builds
- **Performance**: Bypass Mockifyer overhead when not needed
- **Network diagnostics**: Isolate whether issues are in Mockifyer or upstream API

## Turning Mockifyer completely off

Use the **runtime toggle** — not a special scenario name.

| Control | When to use |
|---------|-------------|
| `runtimeMode: 'manual'` + GUI toggle | App owns on/off (settings switch); starts disabled |
| `disableMockifyer()` / `enableMockifyer()` | Explicit on/off after init |
| `runtimeMode: 'off'` | Never patch fetch at all (store builds) |

Scenarios stay for mock data only (`default`, `error-state`, etc.). There is no `"none"` scenario for disabling — that was confusing overlapping control surfaces.

## API Reference

### Configuration

#### `runtimeMode: 'manual'` (Preferred)

The cleanest way to start Mockifyer disabled. Set `runtimeMode: 'manual'` to patch fetch but start in disabled state.

```typescript
const result = await setupMockifyerForReactNative({
  isDev: __DEV__,
  mockDataPath: 'mock-data',
  runtimeMode: 'manual', // first launch: off
  persistRuntimeEnabled: true, // 👈 stay on after enable + app restart
});

// Mockifyer is initialized but disabled (unless user previously enabled)
// Call instance.enableMockifyer() to turn it on — preference is saved
```

**Available runtime modes:**
- `'on'` (default) - Patch and start enabled
- `'off'` - Never patch (production builds)
- `'launch_client'` - Patch only if launch args present (E2E)
- `'manual'` - Patch but start disabled (enable via GUI)

**Aliases:** `'gui'` and `'toggle'` also map to `'manual'`

**Environment variable:** Set `MOCKIFYER_MODE=manual` in `.env`

#### `persistRuntimeEnabled` (recommended with manual)

Without this, `enableMockifyer()` only lasts until the app process dies.

```typescript
persistRuntimeEnabled: true
// → AsyncStorage on React Native, localStorage on web
// Or pass your own { getItem, setItem }
```

Flow:
1. First launch with `runtimeMode: 'manual'` → **off**
2. User toggles on → saved to storage
3. App restart → **still on**
4. User toggles off → saved; next restart stays **off**

Requires `@react-native-async-storage/async-storage` in RN apps (optional peer — if missing, toggle still works but does not persist).

#### `startDisabled` (Legacy, Still Supported)

Alternative to `runtimeMode: 'manual'`. Both work the same way.

```typescript
const result = await setupMockifyerForReactNative({
  isDev: __DEV__,
  mockDataPath: 'mock-data',
  startDisabled: true, // Same as runtimeMode: 'manual'
});
```

**Recommendation:** Use `runtimeMode: 'manual'` for clearer intent.

### Methods

#### `enableMockifyer()`
Enable Mockifyer at runtime. All subsequent requests will go through Mockifyer (mock lookup, recording, dashboard/Redis proxy, etc.).

```typescript
mockifyerInstance.enableMockifyer();
```

#### `disableMockifyer()`
Disable Mockifyer at runtime. All subsequent requests will bypass Mockifyer completely.

```typescript
mockifyerInstance.disableMockifyer();
```

#### `isMockifyerEnabled(): boolean`
Check if Mockifyer is currently enabled at runtime.

```typescript
const isEnabled = mockifyerInstance.isMockifyerEnabled();
console.log('Mockifyer is:', isEnabled ? 'ACTIVE' : 'BYPASSED');
```

## Usage Examples

### Start Disabled (OFF by Default)

**Best for apps that primarily use real APIs:**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Button, Switch } from 'react-native';
import { 
  setupMockifyerForReactNative, 
  isMockifyerReactNativeActive 
} from '@sgedda/mockifyer-fetch';

function App() {
  const [mockifyerInstance, setMockifyerInstance] = useState(null);
  const [isEnabled, setIsEnabled] = useState(false); // Starts disabled!

  useEffect(() => {
    async function init() {
      const result = await setupMockifyerForReactNative({
        isDev: __DEV__,
        mockDataPath: 'mock-data',
        runtimeMode: 'manual', // 👈 Cleaner API!
      });

      if (isMockifyerReactNativeActive(result)) {
        setMockifyerInstance(result.instance);
        // Verify it started disabled
        setIsEnabled(result.instance.isMockifyerEnabled()); // false
      }
    }
    init();
  }, []);

  const handleToggle = (value: boolean) => {
    if (mockifyerInstance) {
      if (value) {
        mockifyerInstance.enableMockifyer();
        console.log('🟢 Mocking enabled');
      } else {
        mockifyerInstance.disableMockifyer();
        console.log('🔴 Using real APIs');
      }
      setIsEnabled(value);
    }
  };

  if (!mockifyerInstance) return null;

  return (
    <View>
      <Switch 
        value={isEnabled} 
        onValueChange={handleToggle} 
      />
      <Button 
        title="Test API"
        onPress={async () => {
          // Will use real API if disabled, mocks if enabled
          const response = await fetch('https://api.example.com/data');
          console.log('Response:', await response.json());
        }}
      />
    </View>
  );
}
```

### Start Enabled (ON by Default - Default Behavior)

**Best for apps that primarily use mocks:**

### React Native with Toggle Component

```tsx
import React, { useEffect, useState } from 'react';
import { View, Button, Text, Switch } from 'react-native';
import { 
  setupMockifyerForReactNative, 
  isMockifyerReactNativeActive 
} from '@sgedda/mockifyer-fetch';

function App() {
  const [mockifyerInstance, setMockifyerInstance] = useState(null);
  const [isEnabled, setIsEnabled] = useState(true);

  useEffect(() => {
    async function init() {
      const result = await setupMockifyerForReactNative({
        isDev: __DEV__,
        mockDataPath: 'mock-data',
        bundledDataPath: './assets/mock-data',
      });

      if (isMockifyerReactNativeActive(result)) {
        setMockifyerInstance(result.instance);
        setIsEnabled(result.instance.isMockifyerEnabled());
      }
    }
    init();
  }, []);

  const handleToggle = (value: boolean) => {
    if (mockifyerInstance) {
      if (value) {
        mockifyerInstance.enableMockifyer();
      } else {
        mockifyerInstance.disableMockifyer();
      }
      setIsEnabled(value);
    }
  };

  if (!mockifyerInstance) {
    return <Text>Loading...</Text>;
  }

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text>Enable Mockifyer: </Text>
        <Switch value={isEnabled} onValueChange={handleToggle} />
        <Text style={{ marginLeft: 10 }}>
          {isEnabled ? '✓ Active' : '✗ Bypassed'}
        </Text>
      </View>
      
      {/* Your app content */}
    </View>
  );
}
```

### React Native with Custom Hook

```tsx
import { useState, useCallback } from 'react';
import type { MockifyerInstance } from '@sgedda/mockifyer-fetch';

function useMockifyerToggle(instance: MockifyerInstance) {
  const [isEnabled, setIsEnabled] = useState(() => 
    instance.isMockifyerEnabled()
  );

  const enable = useCallback(() => {
    instance.enableMockifyer();
    setIsEnabled(true);
  }, [instance]);

  const disable = useCallback(() => {
    instance.disableMockifyer();
    setIsEnabled(false);
  }, [instance]);

  const toggle = useCallback(() => {
    if (isEnabled) {
      disable();
    } else {
      enable();
    }
  }, [isEnabled, enable, disable]);

  return { isEnabled, enable, disable, toggle };
}

// Usage in component
function MyScreen({ mockifyerInstance }) {
  const { isEnabled, toggle } = useMockifyerToggle(mockifyerInstance);

  return (
    <Button 
      title={isEnabled ? "Disable Mockifyer" : "Enable Mockifyer"}
      onPress={toggle}
    />
  );
}
```

### Node.js / Express

```typescript
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

const mockifyer = setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: false,
  useGlobalFetch: true,
});

// Add a debug endpoint to toggle Mockifyer
app.post('/debug/mockifyer/disable', (req, res) => {
  mockifyer.disableMockifyer();
  res.json({ 
    message: 'Mockifyer disabled - all requests will hit real API',
    enabled: mockifyer.isMockifyerEnabled()
  });
});

app.post('/debug/mockifyer/enable', (req, res) => {
  mockifyer.enableMockifyer();
  res.json({ 
    message: 'Mockifyer enabled - requests will use mocks',
    enabled: mockifyer.isMockifyerEnabled()
  });
});

app.get('/debug/mockifyer/status', (req, res) => {
  res.json({ 
    enabled: mockifyer.isMockifyerEnabled(),
    status: mockifyer.isMockifyerEnabled() ? 'ACTIVE' : 'BYPASSED'
  });
});
```

### Development Menu Integration (React Native)

```tsx
import React, { useEffect, useState } from 'react';
import { DevSettings, Platform } from 'react-native';
import type { MockifyerInstance } from '@sgedda/mockifyer-fetch';

function setupMockifyerDevMenu(instance: MockifyerInstance) {
  if (__DEV__ && Platform.OS !== 'web') {
    DevSettings.addMenuItem('Toggle Mockifyer', () => {
      if (instance.isMockifyerEnabled()) {
        instance.disableMockifyer();
        console.log('🔴 Mockifyer DISABLED - Using real API');
      } else {
        instance.enableMockifyer();
        console.log('🟢 Mockifyer ENABLED - Using mocks');
      }
    });

    DevSettings.addMenuItem('Mockifyer Status', () => {
      const status = instance.isMockifyerEnabled() ? 'ACTIVE' : 'BYPASSED';
      console.log(`Mockifyer Status: ${status}`);
      alert(`Mockifyer is ${status}`);
    });
  }
}

// In your app initialization
async function initApp() {
  const result = await setupMockifyerForReactNative({
    isDev: __DEV__,
    mockDataPath: 'mock-data',
  });

  if (isMockifyerReactNativeActive(result)) {
    setupMockifyerDevMenu(result.instance);
  }
}
```

### Settings Screen Example

```tsx
import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet, Alert } from 'react-native';

function SettingsScreen({ mockifyerInstance }) {
  const [isEnabled, setIsEnabled] = useState(() => 
    mockifyerInstance.isMockifyerEnabled()
  );

  const handleToggle = (value: boolean) => {
    Alert.alert(
      value ? 'Enable Mockifyer?' : 'Disable Mockifyer?',
      value 
        ? 'Requests will use mocked responses and dashboard/Redis'
        : 'Requests will bypass Mockifyer and hit the real API directly',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            if (value) {
              mockifyerInstance.enableMockifyer();
            } else {
              mockifyerInstance.disableMockifyer();
            }
            setIsEnabled(value);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Developer Settings</Text>
        
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Mock API Responses</Text>
            <Text style={styles.settingDescription}>
              {isEnabled 
                ? 'Using mocked responses from dashboard/local storage'
                : 'Making direct API calls (real responses)'}
            </Text>
          </View>
          <Switch value={isEnabled} onValueChange={handleToggle} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: 'white',
    marginVertical: 20,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#666',
  },
});
```

## Important Notes

### What Gets Bypassed

When Mockifyer is disabled (`disableMockifyer()`), the following are completely bypassed:

1. **Mock Lookup**: No attempt to find cached mocks
2. **Recording**: Responses are not saved
3. **Dashboard Proxy**: No requests to `proxyBaseUrl`
4. **Redis**: No Redis queries or writes
5. **Domain Path Rules**: No traffic gate checks
6. **Request Limits**: No mock count limits enforced
7. **Activation Mode**: Override even if set to `always`

### What Stays Active

Even when disabled, these still work:

- Original `fetch` or `axios` behavior
- Network interceptors from other libraries
- Standard HTTP headers and configuration
- Error handling and timeouts

### State Persistence

With **`persistRuntimeEnabled: true`**, the toggle **is** restored across app restarts:

```typescript
const result = await setupMockifyerForReactNative({
  isDev: __DEV__,
  mockDataPath: 'mock-data',
  runtimeMode: 'manual',
  persistRuntimeEnabled: true, // AsyncStorage (RN) / localStorage (web)
});
```

| Launch | Behavior |
|--------|----------|
| First (no saved preference) | Follows `runtimeMode: 'manual'` → **off** |
| After `enableMockifyer()` + restart | **on** |
| After `disableMockifyer()` + restart | **off** |
| Launch arg `scenario=…` (Maestro/E2E) | If Mockifyer is already activated (`on` / `manual`, or `launch_client` **with** client id), starts runtime toggle **on** for that session (overrides persisted off). Does **not** activate by itself under `launch_client` without `mockifyerClientId`. |

Without `persistRuntimeEnabled`, the toggle resets on every restart to the `runtimeMode` / `startDisabled` default — except a launch **`scenario`** argument starts the runtime toggle **enabled** when Mockifyer is already active.

## Testing

Run the test suite:

```bash
npm test tests/runtime-toggle.test.ts
```

## See Also

- [React Native Setup Guide](../REACT_NATIVE.md)
- [Dashboard Documentation](../packages/mockifyer-dashboard/README.md)
- [Activation Modes](../docs/activation-modes.md)
