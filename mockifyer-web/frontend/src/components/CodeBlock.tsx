import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { prism } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { useTheme } from '@/lib/use-theme'

interface CodeBlockProps {
  code: string
  language?: string
  className?: string
  small?: boolean
}

export default function CodeBlock({ code, language = 'typescript', className, small = false }: CodeBlockProps) {
  const { toast } = useToast()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  
  const syntaxStyle = isDark ? vscDarkPlus : prism

  const handleCopy = () => {
    navigator.clipboard.writeText(code.trim())
    toast({
      title: 'Copied to clipboard',
    })
  }

  return (
    <div className={cn('relative group rounded-lg overflow-hidden border border-border bg-muted/50', className)}>
      <div className="absolute top-2 right-2 z-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8 px-3 text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur"
        >
          <Copy className="h-3.5 w-3.5 mr-1.5" />
          Copy
        </Button>
      </div>
      <div className={cn('overflow-auto', small ? 'p-3' : 'p-4')}>
        <SyntaxHighlighter
          language={language}
          style={syntaxStyle}
          customStyle={{
            margin: 0,
            padding: 0,
            fontSize: small ? '0.75rem' : '0.875rem',
            lineHeight: '1.65',
            borderRadius: '0',
            background: 'transparent',
            display: 'block',
          }}
          codeTagProps={{
            style: {
              background: 'transparent',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
            }
          }}
          PreTag={({ children, ...props }: any) => (
            <pre {...props} style={{ 
              margin: 0, 
              padding: 0, 
              background: 'transparent',
            }}>
              {children}
            </pre>
          )}
          showLineNumbers={false}
          wrapLines={true}
          wrapLongLines={true}
        >
          {code.trim()}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}

