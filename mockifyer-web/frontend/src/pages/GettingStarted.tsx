import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Link } from 'react-router-dom'
import { CheckCircle2, Code, Zap, BookOpen, Settings, Play, Shield, Terminal, Monitor, TestTube, Clock } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'

export default function GettingStarted() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Zap className="h-8 w-8" />
          Getting Started with Mockifyer
        </h1>
        <p className="text-muted-foreground mt-2">
          Learn how to set up and use Mockifyer in your Node.js project
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
          <CardDescription>
            Get Mockifyer up and running in minutes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs defaultValue="axios" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="axios">Axios</TabsTrigger>
              <TabsTrigger value="fetch">Fetch</TabsTrigger>
            </TabsList>

            <TabsContent value="axios" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    1. Installation
                  </h3>
                  <CodeBlock code={`npm install @sgedda/mockifyer-core @sgedda/mockifyer-axios axios`} language="bash" />
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    2. Setup
                  </h3>
                  <p className="text-muted-foreground mb-2 text-sm">
                    Initialize Mockifyer at the very beginning of your application, before importing axios:
                  </p>
                  <CodeBlock code={`// Initialize Mockifyer FIRST
import { setupMockifyer } from '@sgedda/mockifyer-axios';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: process.env.MOCKIFYER_RECORD === 'true',
  failOnMissingMock: false,
  useGlobalAxios: true
});

// Then import axios
import axios from 'axios';`} language="typescript" />
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    3. Use Your Code Normally
                  </h3>
                  <p className="text-muted-foreground mb-2 text-sm">
                    Your existing code doesn't need to change! Mockifyer automatically intercepts requests:
                  </p>
                  <CodeBlock code={`// This will be automatically mocked or recorded
const response = await axios.get('https://api.example.com/data', {
  params: { id: 123 }
});

console.log(response.data);`} language="typescript" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="fetch" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    1. Installation
                  </h3>
                  <CodeBlock code={`npm install @sgedda/mockifyer-core @sgedda/mockifyer-fetch`} language="bash" />
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    2. Setup
                  </h3>
                  <p className="text-muted-foreground mb-2 text-sm">
                    Initialize Mockifyer at the very beginning of your application:
                  </p>
                  <CodeBlock code={`// Initialize Mockifyer
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: process.env.MOCKIFYER_RECORD === 'true',
  failOnMissingMock: false,
  useGlobalFetch: true
});

// Now fetch() calls are automatically intercepted`} language="typescript" />
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    3. Use Your Code Normally
                  </h3>
                  <p className="text-muted-foreground mb-2 text-sm">
                    Your existing code doesn't need to change! Mockifyer automatically intercepts requests:
                  </p>
                  <CodeBlock code={`// This will be automatically mocked or recorded
const response = await fetch('https://api.example.com/data?id=123');
const data = await response.json();

console.log(data);`} language="typescript" />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Production Safety & Environment Separation
          </CardTitle>
          <CardDescription>
            Ensure Mockifyer never runs in production and only activates in specific environments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                Environment Variable Gating
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                Always gate Mockifyer initialization with <code className="bg-muted px-1 rounded">MOCKIFYER_ENABLED</code>. 
                This ensures Mockifyer code never executes unless explicitly enabled:
              </p>
              <CodeBlock code={`// src/lib/mockifyer.ts
export function initializeMockifyer(): void {
  // Only initialize if explicitly enabled
  if (process.env.MOCKIFYER_ENABLED !== 'true') {
    return; // No initialization, no side effects
  }
  
  setupMockifyer({
    mockDataPath: './mock-data',
    recordMode: process.env.MOCKIFYER_RECORD === 'true',
    useGlobalAxios: true
  });
}`} language="typescript" />
              <p className="text-sm text-muted-foreground mt-2">
                <strong>Key Point:</strong> When <code className="bg-muted px-1 rounded">MOCKIFYER_ENABLED</code> is not set, 
                Mockifyer code never runs. No HTTP client patching, no file system access, zero side effects.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                Conditional Initialization
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                Initialize Mockifyer conditionally in your entry point, before other imports:
              </p>
              <CodeBlock code={`// src/index.ts
import dotenv from 'dotenv';
dotenv.config();

// Only initialize if enabled
if (process.env.MOCKIFYER_ENABLED === 'true') {
  const { initializeMockifyer } = require('./lib/mockifyer');
  initializeMockifyer();
}

// Rest of your app imports
import express from 'express';
// ... other imports`} language="typescript" />
            </div>

            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                Environment-Specific Configuration
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                Use different configurations per environment with <code className="bg-muted px-1 rounded">.env</code> files:
              </p>
              <CodeBlock code={`# .env.development
MOCKIFYER_ENABLED=true
MOCKIFYER_RECORD=false
MOCKIFYER_PATH=./mock-data

# .env.test
MOCKIFYER_ENABLED=true
MOCKIFYER_RECORD=false
MOCKIFYER_PATH=./mock-data

# .env.production
# Mockifyer not enabled - no variables set
# Your app runs normally without any Mockifyer code executing`} language="bash" />
            </div>

            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
                Package.json Scripts
              </h4>
              <p className="text-sm text-muted-foreground mb-2">
                Create separate scripts for different environments:
              </p>
              <CodeBlock code={`{
  "scripts": {
    "dev": "NODE_ENV=development node src/index.ts",
    "dev:mock": "MOCKIFYER_ENABLED=true MOCKIFYER_RECORD=false npm run dev",
    "dev:record": "MOCKIFYER_ENABLED=true MOCKIFYER_RECORD=true npm run dev",
    "start": "NODE_ENV=production node src/index.ts",
    "test": "MOCKIFYER_ENABLED=true jest"
  }
}`} language="json" />
            </div>
          </div>

          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-md">
            <h4 className="font-semibold mb-2 text-green-600 dark:text-green-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Production Safety Guarantees
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>No Code Execution:</strong> When <code className="bg-muted px-1 rounded">MOCKIFYER_ENABLED</code> is not set, Mockifyer code never runs</li>
              <li>• <strong>Runtime Safety:</strong> Conditional initialization prevents code execution and side effects when disabled</li>
              <li>• <strong>Explicit Opt-In:</strong> Must explicitly set environment variable to enable</li>
              <li>• <strong>Zero Side Effects:</strong> Early return means no HTTP client patching, no file system access</li>
              <li>• <strong>Environment Isolation:</strong> Different configs per environment ensure production safety</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Platform Guides
          </CardTitle>
          <CardDescription>
            Detailed setup instructions for different platforms
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="node" className="w-full">
            <TabsList>
              <TabsTrigger value="node">Node Service</TabsTrigger>
              <TabsTrigger value="react-native">React Native</TabsTrigger>
            </TabsList>

            <TabsContent value="node" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Perfect for Node.js services, Express APIs, and backend applications. Mockifyer integrates seamlessly 
                with Axios, Fetch, and other HTTP clients.
              </p>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Complete Example with Environment Gating</h4>
                  <CodeBlock code={`// src/lib/mockifyer.ts
import { setupMockifyer } from '@sgedda/mockifyer-axios';
import path from 'path';

export function initializeMockifyer() {
  // Only initialize if explicitly enabled
  if (process.env.MOCKIFYER_ENABLED !== 'true') {
    return null; // Return null when disabled
  }

  return setupMockifyer({
    recordMode: process.env.MOCKIFYER_RECORD === 'true',
    mockDataPath: process.env.MOCKIFYER_PATH || path.join(__dirname, 'mock-data'),
    useGlobalAxios: true
  });
}

// src/index.ts
import dotenv from 'dotenv';
dotenv.config();

// Only initialize if enabled
if (process.env.MOCKIFYER_ENABLED === 'true') {
  const { initializeMockifyer } = require('./lib/mockifyer');
  initializeMockifyer();
}

import axios from 'axios';

async function main() {
  // Step 1: Record API responses (when MOCKIFYER_ENABLED=true and MOCKIFYER_RECORD=true)
  const response1 = await axios.get('https://jsonplaceholder.typicode.com/posts/1');
  console.log('Response:', response1.data);
  // If recording enabled, file saved: mock-data/2025-11-23_10-53-52_GET_jsonplaceholder_typicode_com_posts_1.json

  // Step 2: Use recorded mocks (when MOCKIFYER_ENABLED=true and MOCKIFYER_RECORD=false)
  const response2 = await axios.get('https://jsonplaceholder.typicode.com/posts/1');
  console.log('Response:', response2.data); // Same data, instant response!
}

main();`} language="typescript" />
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Usage</h4>
                  <CodeBlock code={`# Record mode (saves API responses)
MOCKIFYER_ENABLED=true MOCKIFYER_RECORD=true npm start

# Mock mode (uses saved mocks)
MOCKIFYER_ENABLED=true MOCKIFYER_RECORD=false npm start

# Production (Mockifyer disabled - normal API calls)
npm start`} language="bash" />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="react-native" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Mockifyer works seamlessly with React Native and Expo applications. It supports both development 
                (with recording) and production (with bundled mocks) modes.
              </p>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">1. Install Dependencies</h4>
                  <CodeBlock code={`npm install @sgedda/mockifyer-core @sgedda/mockifyer-fetch expo-file-system`} language="bash" />
                </div>

                <div>
                  <h4 className="font-semibold mb-2">2. Configure Metro Bundler</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Mockifyer uses Node.js built-in modules that don't exist in React Native. Configure Metro to stub them:
                  </p>
                  <CodeBlock code={`// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const { configureMetroForMockifyer } = require('@sgedda/mockifyer-fetch/metro-config');

const config = getDefaultConfig(__dirname);
module.exports = configureMetroForMockifyer(config);`} language="javascript" />
                </div>

                <div>
                  <h4 className="font-semibold mb-2">3. Initialize Mockifyer</h4>
                  <CodeBlock code={`// mockifyer-setup.ts
import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch/react-native';

export async function initializeMockifyer() {
  // Only enable in development OR if explicitly enabled
  const isEnabled = process.env.MOCKIFYER_ENABLED === 'true' || __DEV__;
  
  if (!isEnabled) {
    return null; // Disabled in production builds
  }

  return await setupMockifyerForReactNative({
    isDev: __DEV__, // Automatically false in production builds
    mockDataPath: 'mock-data',
    bundledDataPath: './assets/mock-data',
    recordMode: __DEV__ && process.env.MOCKIFYER_RECORD === 'true',
  });
}

// App.tsx
import { useEffect } from 'react';
import { initializeMockifyer } from './mockifyer-setup';

export default function App() {
  useEffect(() => {
    initializeMockifyer();
  }, []);

  // Your app code...
}`} language="typescript" />
                </div>

                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                  <h4 className="font-semibold mb-2 text-yellow-400">⚠️ React Native Bundle Size</h4>
                  <p className="text-sm text-muted-foreground">
                    <strong>Important:</strong> If Mockifyer is imported in your React Native code, Metro bundler will 
                    include it in <strong>all builds</strong> (development and production), regardless of <code className="bg-muted px-1 rounded">__DEV__</code> checks. 
                    Conditional execution prevents code from running but doesn't prevent bundling.
                  </p>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                    <li>• <strong>Bundle Impact:</strong> ~50-200KB+ (gzipped) in all builds if Mockifyer is imported</li>
                    <li>• <strong>devDependencies:</strong> Won't work if you need Mockifyer in any deployed environment</li>
                    <li>• <strong>All Builds:</strong> Both development and production bundles include Mockifyer if imported</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Environment Configuration</CardTitle>
          <CardDescription>
            Configure Mockifyer using environment variables
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono">MOCKIFYER_ENABLED</code>
                  <Badge variant="outline">Required</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enable or disable Mockifyer. Set to <code className="bg-muted px-1 rounded">true</code> to activate.
                </p>
                <CodeBlock code={`MOCKIFYER_ENABLED=true`} language="bash" className="mt-2" small />
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono">MOCKIFYER_PATH</code>
                  <Badge variant="outline">Optional</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Path to the directory where mock files are stored and loaded from.
                </p>
                <CodeBlock code={`MOCKIFYER_PATH=./mock-data`} language="bash" className="mt-2" small />
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono">MOCKIFYER_RECORD</code>
                  <Badge variant="outline">Optional</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enable recording mode. When <code className="bg-muted px-1 rounded">true</code>, real API responses are saved as mock files.
                </p>
                <CodeBlock code={`MOCKIFYER_RECORD=true`} language="bash" className="mt-2" small />
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono">MOCKIFYER_MAX_SCENARIOS</code>
                  <Badge variant="outline">Optional</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Maximum number of scenarios allowed. If not set, there is no limit.
                </p>
                <CodeBlock code={`MOCKIFYER_MAX_SCENARIOS=3`} language="bash" className="mt-2" small />
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono">MOCKIFYER_MAX_REQUESTS_PER_SCENARIO</code>
                  <Badge variant="outline">Optional</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Maximum number of requests (mock files) allowed per scenario. If not set, there is no limit.
                </p>
                <CodeBlock code={`MOCKIFYER_MAX_REQUESTS_PER_SCENARIO=20`} language="bash" className="mt-2" small />
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono">MOCKIFYER_DATE</code>
                  <Badge variant="outline">Optional</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Set a fixed date for testing time-dependent functionality. Use ISO format.
                </p>
                <CodeBlock code={`MOCKIFYER_DATE=2024-03-16T12:00:00Z`} language="bash" className="mt-2" small />
              </div>
            </div>
          </div>

          <div className="p-4 bg-muted rounded-md">
            <p className="text-sm font-semibold mb-2">Example .env file</p>
            <CodeBlock code={`# Mockifyer Configuration
MOCKIFYER_ENABLED=true
MOCKIFYER_PATH=./mock-data
MOCKIFYER_RECORD=true

# Optional: Scenario Limits
MOCKIFYER_MAX_SCENARIOS=3
MOCKIFYER_MAX_REQUESTS_PER_SCENARIO=20

# Your API Keys (if needed)
WEATHER_API_KEY=your_key_here
FOOTBALL_API_KEY=your_key_here`} language="bash" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
          <CardDescription>
            Understanding Mockifyer's workflow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold mb-1">Record Mode (Development)</h4>
                <p className="text-sm text-muted-foreground">
                  When <code className="bg-muted px-1 rounded">MOCKIFYER_RECORD=true</code>, Mockifyer intercepts your HTTP requests,
                  makes real API calls, and saves the responses as mock files in your <code className="bg-muted px-1 rounded">mock-data</code> directory.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold mb-1">Replay Mode (Testing)</h4>
                <p className="text-sm text-muted-foreground">
                  When <code className="bg-muted px-1 rounded">MOCKIFYER_RECORD=false</code>, Mockifyer intercepts requests and returns
                  saved mock responses instead of making real API calls. Perfect for fast, reliable tests!
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold mb-1">No Code Changes Required</h4>
                <p className="text-sm text-muted-foreground">
                  Your existing HTTP client code works exactly as before. Mockifyer handles everything transparently,
                  so you can switch between real APIs and mocks without changing your application code.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            CLI Commands
          </CardTitle>
          <CardDescription>
            Useful command-line tools for managing mocks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="generate-bundle" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="generate-bundle">Generate Bundle</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="sync">Sync Commands</TabsTrigger>
            </TabsList>

            <TabsContent value="generate-bundle" className="space-y-3 mt-4">
              <p className="text-sm text-muted-foreground">
                Generates a TypeScript/JavaScript/JSON bundle from recorded mock data files. Especially useful for 
                React Native production builds where filesystem access is limited.
              </p>
              <CodeBlock code={`# Via npx (no installation needed)
npx @sgedda/mockifyer-core generate-bundle \\
  --input ./mock-data \\
  --output ./assets/mock-data.ts \\
  --format typescript

# Options:
# -i, --input <path>     Path to mock data directory
# -o, --output <path>    Output file path
# -f, --format <format>  Output format: json, typescript, javascript`} language="bash" />
            </TabsContent>

            <TabsContent value="dashboard" className="space-y-3 mt-4">
              <p className="text-sm text-muted-foreground">
                The Mockifyer Dashboard is a web interface for viewing, editing, and managing your mock data files.
              </p>
              <CodeBlock code={`# Start the dashboard
npx @sgedda/mockifyer-dashboard

# Or specify path and port
npx @sgedda/mockifyer-dashboard --path ./mock-data --port 8080`} language="bash" />
              <p className="text-sm text-muted-foreground">
                The dashboard provides:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Browse and search all mock files</li>
                <li>Edit mock responses with JSON editor</li>
                <li>View request details (URL, headers, params, body)</li>
                <li>Delete unwanted mocks</li>
                <li>View statistics and usage patterns</li>
              </ul>
            </TabsContent>

            <TabsContent value="sync" className="space-y-3 mt-4">
              <div>
                <h4 className="font-semibold mb-2">Sync FROM Device → Project</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Copy mock files from your device/simulator to your project folder:
                </p>
                <CodeBlock code={`# Auto-detect device
npx mockifyer-sync-from-device

# Explicit platform
npx mockifyer-sync-from-device --ios
npx mockifyer-sync-from-device --android`} language="bash" />
              </div>
              <div>
                <h4 className="font-semibold mb-2">Sync TO Device ← Project</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  Copy mock files from your project folder to your device/simulator:
                </p>
                <CodeBlock code={`# Auto-detect device
npx mockifyer-sync-to-device

# Explicit platform
npx mockifyer-sync-to-device --ios
npx mockifyer-sync-to-device --android`} language="bash" />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Deterministic Dates with Sinon Fake Timers
          </CardTitle>
          <CardDescription>
            Using Sinon fake timers alongside Mockifyer for deterministic dates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Mockifyer provides <code className="bg-muted px-1 rounded">getCurrentDate()</code> for getting manipulated dates, 
            but for <strong>deterministic dates</strong> where <code className="bg-muted px-1 rounded">new Date()</code> and 
            <code className="bg-muted px-1 rounded">Date.now()</code> return fake time globally, you can use Sinon fake timers 
            alongside Mockifyer in Node.js environments.
          </p>

          <div>
            <h4 className="font-semibold mb-2">When to Use Fake Timers</h4>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Your code calls <code className="bg-muted px-1 rounded">new Date()</code> or <code className="bg-muted px-1 rounded">Date.now()</code> directly</li>
              <li>You need <code className="bg-muted px-1 rounded">setTimeout</code>/<code className="bg-muted px-1 rounded">setInterval</code> to work with fake time</li>
              <li>You want deterministic dates across your entire application</li>
              <li>You're testing time-dependent logic</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Setting Up Sinon Fake Timers</h4>
            <CodeBlock code={`import sinon from 'sinon';
import { useFakeTimers } from 'sinon';
import { setupMockifyer } from '@sgedda/mockifyer-fetch';
import { getCurrentDate } from '@sgedda/mockifyer-core';

// Initialize Mockifyer with date manipulation
const mockifyer = setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: false,
});

// Setup Sinon fake timers for global Date manipulation
const fixedDate = '2024-12-25T00:00:00.000Z';
const clock = useFakeTimers({
  now: new Date(fixedDate), // Same date as Mockifyer
  toFake: ['Date', 'setTimeout', 'setInterval'],
});

// Now both new Date() and getCurrentDate() return the same fake date
const globalDate = new Date(); // Returns 2024-12-25 (from Sinon)
const mockifyerDate = getCurrentDate(); // Returns 2024-12-25 (from Mockifyer)`} language="typescript" />
          </div>

          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-md">
            <h4 className="font-semibold mb-2 text-blue-400">Best Practices</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Use Mockifyer's <code className="bg-muted px-1 rounded">getCurrentDate()</code> when you can - it's simpler and works everywhere</li>
              <li>• Use Sinon fake timers when your code uses <code className="bg-muted px-1 rounded">new Date()</code> or <code className="bg-muted px-1 rounded">Date.now()</code> directly in Node.js</li>
              <li>• Keep dates in sync: Use the same date for Mockifyer config and fake timers</li>
              <li>• Clean up: Always restore fake timers when done (<code className="bg-muted px-1 rounded">clock.restore()</code>)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Automatic Test Generation
          </CardTitle>
          <CardDescription>
            Automatically generate unit tests when recording mocks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Mockifyer can automatically generate unit tests when recording mocks. This feature creates test files 
            that use your recorded mock data, ensuring tests are always in sync with your mocks.
          </p>

          <div>
            <h4 className="font-semibold mb-2">Features</h4>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>✅ Automatic test generation - Tests created when mocks are saved</li>
              <li>✅ Multiple frameworks - Supports Jest, Vitest, and Mocha</li>
              <li>✅ Realistic data - Uses recorded real API responses</li>
              <li>✅ Zero setup - Generated tests include all setup code</li>
              <li>✅ Smart grouping - Organize tests by endpoint, scenario, or file</li>
              <li>✅ GraphQL support - Automatically detects and handles GraphQL requests</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Enable Test Generation</h4>
            <CodeBlock code={`import { setupMockifyer } from '@sgedda/mockifyer-axios';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: true,
  useGlobalAxios: true,
  
  // Enable test generation
  generateTests: {
    enabled: true,
    framework: 'jest', // 'jest' | 'vitest' | 'mocha'
    outputPath: './tests/generated',
    testPattern: '{endpoint}.test.ts',
    includeSetup: true,
    groupBy: 'endpoint' // 'endpoint' | 'scenario' | 'file'
  }
});`} language="typescript" />
          </div>

          <div>
            <h4 className="font-semibold mb-2">Complete Workflow</h4>
            <CodeBlock code={`# 1. Record mocks with test generation enabled
MOCKIFYER_ENABLED=true MOCKIFYER_RECORD=true npm start

# 2. Make API calls in your app
# → Mocks saved
# → Tests generated automatically

# 3. Run generated tests
npm test tests/generated

# 4. Tests pass with realistic data!`} language="bash" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Example Project</CardTitle>
          <CardDescription>
            This Express API Mock project demonstrates Mockifyer in action
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This example project shows how to use Mockifyer with Express.js, TypeScript, and both Axios and Fetch.
            Check out the implementation in <code className="bg-muted px-1 rounded">src/lib/mockifyer.ts</code>.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-md">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Play className="h-4 w-4" />
                Try It Out
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Test API endpoints and see Mockifyer in action
              </p>
              <Link to="/playground">
                <Button size="sm" className="w-full">Open Playground</Button>
              </Link>
            </div>

            <div className="p-4 border rounded-md">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configure
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Manage date settings and view configuration
              </p>
              <Link to="/settings">
                <Button size="sm" variant="outline" className="w-full">Open Settings</Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
          <CardDescription>
            Explore more features and documentation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/playground" className="p-4 border rounded-md hover:bg-accent transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Play className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">Playground</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Test API endpoints interactively and see mock responses
              </p>
            </Link>

            <Link to="/request-flow" className="p-4 border rounded-md hover:bg-accent transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">Request Flow</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Visualize how requests flow through Mockifyer
              </p>
            </Link>

            <Link to="/settings" className="p-4 border rounded-md hover:bg-accent transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <h4 className="font-semibold">Settings</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Configure date manipulation and view runtime settings
              </p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
