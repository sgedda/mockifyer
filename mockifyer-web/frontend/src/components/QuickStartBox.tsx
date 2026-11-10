import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Rocket } from 'lucide-react'
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
  recordMode: true,
  recordResponses: true
});`
    }

    if (isRN && !isFetch) {
      return `// mockifyer-setup.ts
import { setupMockifyerForReactNative } from '@sgedda/mockifyer-axios';

setupMockifyerForReactNative({
  mockDataPath: './mock-data',
  recordMode: true,
  recordResponses: true,
  useGlobalAxios: true
});`
    }

    if (!isRN && isFetch) {
      return `// mockifyer-setup.ts (or instrumentation.ts for Next.js)
import { setupMockifyer } from '@sgedda/mockifyer-fetch';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: true,
  recordResponses: true,
  useGlobalFetch: true
});`
    }

    // node-axios
    return `// mockifyer-setup.ts
import { setupMockifyer } from '@sgedda/mockifyer-axios';

setupMockifyer({
  mockDataPath: './mock-data',
  recordMode: true,
  recordResponses: true,
  useGlobalAxios: true
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
          <p className="text-sm text-muted-foreground mb-2">2. Setup</p>
          <CodeBlock language="typescript" code={getSetupCode()} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            3. Run your app and make API calls — responses are recorded to <code className="bg-muted px-1 rounded text-xs">./mock-data/</code>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
