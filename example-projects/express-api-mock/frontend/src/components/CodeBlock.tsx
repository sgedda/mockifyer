import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cn } from '@/lib/utils'

interface CodeBlockProps {
  code: string
  language?: string
  className?: string
  small?: boolean
}

export default function CodeBlock({ code, language = 'typescript', className, small = false }: CodeBlockProps) {
  return (
    <div className={cn('rounded-md overflow-hidden', className)}>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: small ? '0.5rem' : '1rem',
          fontSize: small ? '0.75rem' : '0.875rem',
          lineHeight: '1.5',
          borderRadius: '0.375rem',
          background: 'hsl(var(--muted))',
        }}
        showLineNumbers={false}
        wrapLines={true}
        wrapLongLines={true}
        PreTag="div"
      >
        {code.trim()}
      </SyntaxHighlighter>
    </div>
  )
}

