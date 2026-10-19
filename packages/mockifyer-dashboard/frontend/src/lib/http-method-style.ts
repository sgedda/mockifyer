/** Text color for HTTP methods so compact hop rows stay scannable. */
export function httpMethodTextClass(method: string | null | undefined): string {
  switch ((method ?? 'GET').toUpperCase()) {
    case 'GET':
      return 'text-sky-400'
    case 'POST':
      return 'text-emerald-400'
    case 'PUT':
      return 'text-amber-400'
    case 'PATCH':
      return 'text-orange-400'
    case 'DELETE':
      return 'text-red-400'
    case 'HEAD':
      return 'text-violet-400'
    case 'OPTIONS':
      return 'text-fuchsia-400'
    default:
      return 'text-zinc-400'
  }
}
