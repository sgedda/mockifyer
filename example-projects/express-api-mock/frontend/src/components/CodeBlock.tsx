import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Copy } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface CodeBlockProps {
  code: string
  language?: string
  className?: string
  small?: boolean
}

export default function CodeBlock({ code, language = 'typescript', className, small = false }: CodeBlockProps) {
  const { toast } = useToast()

  const handleCopy = () => {
    navigator.clipboard.writeText(code.trim())
    toast({
      title: 'Copied',
      description: 'Code copied to clipboard',
    })
  }

  return (
    <div className={cn('rounded-md overflow-hidden border bg-[#1e1e1e]', className)}>
      <div className="flex items-center justify-between p-2 border-b bg-[#1e1e1e]">
        <span className="text-xs text-muted-foreground uppercase font-medium">{language || 'code'}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2 text-xs"
        >
          <Copy className="h-3 w-3 mr-1" />
          Copy
        </Button>
      </div>
      <div className={cn('overflow-auto', small ? 'p-2' : 'p-4')}>
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: 0,
            fontSize: small ? '0.75rem' : '0.875rem',
            lineHeight: '1.5',
            borderRadius: '0',
            background: '#1e1e1e',
            display: 'block',
          }}
          codeTagProps={{
            style: {
              background: '#1e1e1e',
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
            }
          }}
          PreTag={({ children, ...props }: any) => (
            <pre {...props} style={{ 
              margin: 0, 
              padding: 0, 
              background: '#1e1e1e',
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

