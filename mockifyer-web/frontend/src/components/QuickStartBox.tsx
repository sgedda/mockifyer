import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Rocket, AlertCircle } from 'lucide-react'
import CodeBlock from '@/components/CodeBlock'

interface QuickStartBoxProps {
  variant: 'node-fetch' | 'node-axios' | 'react-native-fetch' | 'react-native-axios'
  title?: string
}

export default function QuickStartBox({ variant, title = 'Quick Start' }: QuickStartBoxProps) {
  const getInstallCommand = () => {
    switch (variant) {
      case 'node-fetch':
      case 'react-native-fetch':
        return 'npm install --save-dev @sgedda/mockifyer-fetch'
      case 'node-axios':
      case 'react-native-axios':
        return 'npm install --save-dev @sgedda/mockifyer-axios'
    }
  }

  const getSetupCode = () => {
    const isRN = variant.startsWith('react-native')
    const isFetch = variant.includes('fetch')

    if (isRN && isFetch) {
      return `// mockifyer-setup.ts
import { setupMockifyerForReactNative } from '@sgedda/mockifyer-fetch';

setupMockifyerForReactNative({
  mockDataPath: './mock-data',
  recordMode: true
});`
    }

    if (isRN && !isFetch) {
      return `// mockifyer-setup.ts
import { setupMockifyerForReactNative } from '@sgedda/mockifyer-axios';

setupMockifyerForReactNative({
  mockDataPath: './mock-data',
  recordMode: true,
  useGlobalAxios: true
});`
    }

    if (!isRN && isFetch) {
      return `// mockifyer-setup.ts (or instrumentation.ts for Next.js)
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: true,
  useGlobalFetch: true
});`
    }

    // node-axios
    return `// mockifyer-setup.ts
import { setupMockifyer } from '@sgedda/mockifyer-axios';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: true,
  useGlobalAxios: true
});`
  }

  const getQuickDemoCode = () => {
    const isRN = variant.startsWith('react-native')
    const isFetch = variant.includes('fetch')

    if (isRN && isFetch) {
      return `// For quick demos: capture-everything mode
process.env.MOCKIFYER_RECORD_RESPONSES = 'true';
process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API = 'false';

setupMockifyerForReactNative({
  mockDataPath: './mock-data',
  recordMode: true,
  domainPathRulesMode: 'record_all'
});`
    }

    if (isRN && !isFetch) {
      return `// For quick demos: capture-everything mode
process.env.MOCKIFYER_RECORD_RESPONSES = 'true';
process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API = 'false';

setupMockifyerForReactNative({
  mockDataPath: './mock-data',
  recordMode: true,
  useGlobalAxios: true,
  domainPathRulesMode: 'record_all'
});`
    }

    if (!isRN && isFetch) {
      return `// For quick demos: capture-everything mode
process.env.MOCKIFYER_RECORD_RESPONSES = 'true';
process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API = 'false';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: true,
  useGlobalFetch: true,
  domainPathRulesMode: 'record_all'
});`
    }

    // node-axios
    return `// For quick demos: capture-everything mode
process.env.MOCKIFYER_RECORD_RESPONSES = 'true';
process.env.MOCKIFYER_RECORD_DEFAULT_ALWAYS_USE_REAL_API = 'false';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: true,
  useGlobalAxios: true,
  domainPathRulesMode: 'record_all'
});`
  }

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Rocket className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-2">1. Install</p>
          <CodeBlock language="bash" code={getInstallCommand()} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-2">2. Setup (selective recording)</p>
          <CodeBlock language="typescript" code={getSetupCode()} />
          <p className="text-xs text-muted-foreground mt-2">
            With <code className="bg-muted px-1 rounded">recordMode: true</code>, requests land as request-only stubs in the{' '}
            <code className="bg-muted px-1 rounded">_scratch</code> scenario and stay on the live API until you activate mocks in the dashboard or via domain-path rules.
          </p>
        </div>
        
        <div className="border-t border-border pt-4">
          <div className="flex items-start gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
              For quick demos: capture-everything mode
            </p>
          </div>
          <CodeBlock language="typescript" code={getQuickDemoCode()} />
          <p className="text-xs text-muted-foreground mt-2">
            Captures full responses and replays immediately. Heavy. See{' '}
            <a 
              href="https://github.com/sgedda/mockifyer/tree/main/demos/record-replay-basics" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              demos/record-replay-basics
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
