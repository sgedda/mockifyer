/**
 * Convert an ISO timestamp to a `datetime-local` input value (local timezone, minute precision).
 */
export function isoToDatetimeLocalValue(iso: string): string {
  try {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  } catch {
    return ''
  }
}

/**
 * Convert a `datetime-local` value (local timezone) to an ISO 8601 UTC string.
 */
export function datetimeLocalValueToIso(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid datetime-local value: ${value}`)
  }
  return date.toISOString()
}
