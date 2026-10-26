/** Shared URL helpers for Folders / Domains mock trees. */

export function safeParseUrl(input: string): URL | null {
  try {
    return new URL(input)
  } catch {
    return null
  }
}

export function splitPathname(pathname: string): string[] {
  const cleaned = pathname.replace(/\/+/g, '/').replace(/^\/|\/$/g, '')
  if (!cleaned) return []
  return cleaned.split('/').filter(Boolean)
}
