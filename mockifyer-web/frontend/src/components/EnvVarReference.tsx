import { ENV_VAR_DOCS } from '@/lib/product-docs'

export default function EnvVarReference() {
  return (
    <div className="space-y-4">
      {ENV_VAR_DOCS.map((env) => (
        <div key={env.name}>
          <code className="bg-muted px-2 py-1 rounded text-sm font-mono">{env.name}</code>
          {env.values && (
            <span className="text-muted-foreground text-xs ml-2">({env.values})</span>
          )}
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{env.description}</p>
        </div>
      ))}
    </div>
  )
}
